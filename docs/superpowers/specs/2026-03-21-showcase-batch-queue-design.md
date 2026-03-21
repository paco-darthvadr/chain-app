# Showcase Mode: Serial Batch Queue for Chain Updates

## Problem

Showcase mode calls `updateidentity` on every move to keep the on-chain SubID in sync with the live game state. When moves come in fast, concurrent `updateidentity` RPC calls hit the Verus daemon simultaneously. The daemon cannot handle concurrent identity updates — it returns 500 errors because the UTXO set conflicts.

## Solution

A per-game in-memory queue that batches moves and serializes `updateidentity` calls. Only one RPC call is in-flight at a time per game, and only the latest accumulated state is sent (since `updateidentity` overwrites the entire `contentmultimap`).

## Architecture

```
Move 1 ──→ enqueue ──→ queue: [1]
Move 2 ──→ enqueue ──→ queue: [1, 2]
Move 3 ──→ enqueue ──→ queue: [1, 2, 3] → batch size reached → worker takes state-at-move-3, clears queue
                                            ↓
                                    updateidentity (state with moves 1-3)
                                            ↓
                                    txid returned → done
Move 4 ──→ enqueue ──→ queue: [4]
Move 5 ──→ enqueue ──→ queue: [4, 5]
Move 6 ──→ enqueue ──→ queue: [4, 5, 6] → batch size reached → worker takes state-at-move-6
                                            ↓
                                    updateidentity (state with moves 1-6)
                                            ...
Game end ──→ flushQueue() → sends any remaining state
          ──→ storeOnChain() → final updateidentity with sigs, hash, winner
```

Key: each `updateidentity` sends the FULL game state up to that point (all moves, player names, sigs, status). Nothing is lost by skipping intermediate updates.

## Components

### 1. Chain Queue (`app/utils/modes/showcase/chain-queue.ts`)

New file. In-memory queue with three exports:

**`enqueueChainUpdate(gameId, update)`**
- Called by showcase handler on every move
- Pushes update to the game's queue
- If `flushing` flag is set, does NOT trigger `processQueue` (flush owns the drain)
- Otherwise, if queue length >= `SHOWCASE_BATCH_SIZE` and worker not already running, starts the worker

**`flushQueue(gameId)`**
- Called by `storeOnChain` at game end
- Sets `flushing = true` to prevent `enqueueChainUpdate` from triggering new workers
- Waits for any in-progress `updateidentity` to finish (spin-wait on `processing`)
- Processes any remaining queued updates (calls `processQueue` directly)
- Deletes the game's queue (cleanup)
- This prevents a race where a late move triggers a new worker between flush's spin-wait ending and its own `processQueue` call

**`processQueue(gameId)` (internal)**
- Serial worker loop:
  1. Take the **latest** entry from queue, log how many intermediate updates were skipped (for debugging)
  2. Clear queue
  3. Call `updateidentity` via `updateGameOnChain`
  4. On success (txid returned): log, check if more entries accumulated during processing, loop
  5. On RPC error: classify the error (see Error Classification below), call `waitForNextBlock()`, then retry — grab freshest state if new moves queued in the meantime
  6. On daemon unreachable: stop retrying, log error
- Sets `processing = false` when done

**Error classification:** Errors from the RPC layer come in two forms:
- **Retryable** (UTXO conflict, RPC-level error): `rpcCall` throws an `Error` with message `"RPC ... error: ..."`. These indicate a transient problem — retry after next block.
- **Fatal** (daemon down): axios throws `AxiosError` with `error.code === 'ECONNREFUSED'` or `error.code === 'ETIMEDOUT'`. These indicate the daemon is unreachable — stop retrying.
- Check `error.code` first for connection errors, then treat all other errors as retryable.

**Data structures:**
```typescript
interface QueuedUpdate {
  subIdName: string;
  liveState: LiveGameState;
  keys: VDXFKeySet;
  parentIdentityName: string;
  moveNum: number;
}

interface GameQueue {
  updates: QueuedUpdate[];
  processing: boolean;
  flushing: boolean;
}

const gameQueues: Map<string, GameQueue> = new Map();
```

Note: `batchSize` is read from `process.env.SHOWCASE_BATCH_SIZE` at enqueue time (module-level constant), not stored per queue.

### 2. Block Wait Utility (`app/utils/verus-rpc.ts`)

New shared export:

**`waitForNextBlock(maxWaitMs = 300000)`**
- Polls `getblockcount` every 5 seconds
- Returns when block height increments
- Times out after `maxWaitMs` (default 5 minutes) — throws if no new block arrives, consistent with `waitForConfirmation`'s existing timeout pattern in the same file
- Shared utility — any mode or feature can use it for block-aware retry logic

### 3. Handler Changes (`app/utils/modes/showcase/handler.ts`)

**`onMove` method (lines 82-97):**
- Replace direct `updateGameOnChain` call with `enqueueChainUpdate`
- The SubID-ready check (`freshSession?.subIdAddress`) stays in the handler — only enqueue if the SubID is confirmed on-chain. Once a SubID has an address, it remains valid for the life of the game (SubIDs don't become un-ready), so the queue doesn't need to re-check.
- Still fire-and-forget from the move handler's perspective — the move/socket relay is not blocked

**`storeOnChain` method (lines 145-209):**
- Add `await flushQueue(game.id)` before the final `updateGameOnChain` call
- This ensures any pending mid-game updates complete before the final state is written

### 4. Environment Variable

**`SHOWCASE_BATCH_SIZE`** (default: `3`)
- How many moves accumulate before the queue fires an `updateidentity`
- Range: 1-5
- Value of 1 = update every move (serial, no batching)
- Value of 5 = update every 5 moves (fewer RPC calls, less live visibility)
- Validated at module load: `Math.max(1, Math.min(5, parseInt(process.env.SHOWCASE_BATCH_SIZE || '3', 10) || 3))` — clamps invalid/NaN values to default
- Added to `.env.example`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `updateidentity` returns txid | Success — proceed to next batch |
| `updateidentity` returns RPC error (500) | Wait for next block, retry with freshest state |
| Daemon unreachable (ECONNREFUSED) | Stop retrying, log error. Game-end `storeOnChain` will attempt final write. |
| Queue has entries when game ends | `flushQueue` drains them before final store |
| Next.js process restarts mid-game | Queue lost (in-memory). `storeOnChain` at game end sends complete final state regardless — no data loss. |

## Scope

**In scope:**
- Chain queue with batching and serial processing
- Block-aware retry for failed updates
- `waitForNextBlock` shared utility
- `SHOWCASE_BATCH_SIZE` env var
- Wire queue into showcase handler

**Out of scope:**
- DB-backed queue persistence (unnecessary — game-end store is the safety net)
- Opid polling (`updateidentity` returns txid directly, confirmed via `help updateidentity`)
- Changes to normal mode (already fire-and-forget at game end only)
- Changes to `updateGameOnChain` or `buildContentMultimap` (they work correctly as-is)
