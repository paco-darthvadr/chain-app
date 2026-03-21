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
- If queue length >= `SHOWCASE_BATCH_SIZE` and worker not already running, starts the worker

**`flushQueue(gameId)`**
- Called by `storeOnChain` at game end
- Waits for any in-progress `updateidentity` to finish
- Processes any remaining queued updates
- Deletes the game's queue (cleanup)

**`processQueue(gameId)` (internal)**
- Serial worker loop:
  1. Take the **latest** entry from queue (discard intermediates — they're stale)
  2. Clear queue
  3. Call `updateidentity` via `updateGameOnChain`
  4. On success (txid returned): log, check if more entries accumulated during processing, loop
  5. On RPC error (500, UTXO conflict): call `waitForNextBlock()`, then retry — grab freshest state if new moves queued in the meantime
  6. On daemon unreachable (ECONNREFUSED, ETIMEDOUT): stop retrying, log error
- Sets `processing = false` when done

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
  batchSize: number;
}

const gameQueues: Map<string, GameQueue> = new Map();
```

### 2. Block Wait Utility (`app/utils/verus-rpc.ts`)

New shared export:

**`waitForNextBlock()`**
- Polls `getblockcount` every 5 seconds
- Returns when block height increments
- Shared utility — any mode or feature can use it for block-aware retry logic

### 3. Handler Changes (`app/utils/modes/showcase/handler.ts`)

**`onMove` method (lines 82-97):**
- Replace direct `updateGameOnChain` call with `enqueueChainUpdate`
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
