# Showcase Batch Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-move `updateidentity` calls in showcase mode with a serial batch queue that eliminates concurrent RPC 500 errors.

**Architecture:** A per-game in-memory queue accumulates moves. Every `SHOWCASE_BATCH_SIZE` moves (env var, default 3), the queue worker fires ONE `updateidentity` with the latest accumulated game state. The worker processes sequentially — only the latest state is sent (since `updateidentity` overwrites the full `contentmultimap`). On failure, retry after next block. At game end, flush remaining queued updates before the final store.

**Tech Stack:** Next.js 14, TypeScript, Verus RPC (updateidentity, getblockcount), axios

**Spec:** `docs/superpowers/specs/2026-03-21-showcase-batch-queue-design.md`

---

## File Structure

```
app/utils/
├── verus-rpc.ts              # MODIFY: add waitForNextBlock() shared utility
└── modes/showcase/
    ├── chain-queue.ts         # CREATE: serial batch queue (enqueueChainUpdate, flushQueue, processQueue)
    ├── handler.ts             # MODIFY: wire queue into onMove + storeOnChain
    └── live-storage.ts        # NO CHANGES (updateGameOnChain works as-is)

.env.example                   # MODIFY: add SHOWCASE_BATCH_SIZE
```

---

### Task 1: Add `waitForNextBlock` to verus-rpc.ts

**Files:**
- Modify: `app/utils/verus-rpc.ts:42` (after `waitForConfirmation`)

- [ ] **Step 1: Add the `waitForNextBlock` function**

Append after the closing brace of `waitForConfirmation` (line 42):

```typescript
/**
 * Wait for the next block to be mined.
 * Polls getblockcount every 5 seconds until the height increments.
 * Throws if no new block arrives within maxWaitMs.
 */
export async function waitForNextBlock(maxWaitMs: number = 300000): Promise<void> {
  const startHeight = await rpcCall('getblockcount', []);
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const currentHeight = await rpcCall('getblockcount', []);
      if (currentHeight > startHeight) return;
    } catch {
      // If we can't reach the daemon during polling, keep trying until timeout
    }
  }
  throw new Error(`waitForNextBlock timed out after ${maxWaitMs}ms — no new block`);
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: build succeeds (new export is unused, but that's fine — no tree-shaking errors).

- [ ] **Step 3: Commit**

```bash
git add app/utils/verus-rpc.ts
git commit -m "feat: add waitForNextBlock shared utility to verus-rpc"
```

---

### Task 2: Create the Chain Queue

**Files:**
- Create: `app/utils/modes/showcase/chain-queue.ts`

- [ ] **Step 1: Create the queue module**

```typescript
// app/utils/modes/showcase/chain-queue.ts

import { updateGameOnChain, LiveGameState } from './live-storage';
import { waitForNextBlock } from '@/app/utils/verus-rpc';
import type { VDXFKeySet } from '@/app/games/types';

// --- Types ---

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

// --- State ---

const gameQueues: Map<string, GameQueue> = new Map();

const BATCH_SIZE = Math.max(1, Math.min(5,
  parseInt(process.env.SHOWCASE_BATCH_SIZE || '3', 10) || 3
));

// --- Private helpers ---

/**
 * Check if an error indicates the daemon is unreachable (fatal, don't retry).
 * All other errors are treated as retryable (UTXO conflict, RPC error, etc.).
 */
function isDaemonDown(error: any): boolean {
  const code = error?.code;
  return code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT';
}

/**
 * Serial worker that processes one update at a time.
 * Only sends the LATEST state (not intermediate states) since
 * updateidentity overwrites the entire contentmultimap.
 */
async function processQueue(gameId: string): Promise<void> {
  const gq = gameQueues.get(gameId);
  if (!gq || gq.processing || gq.updates.length === 0) return;

  gq.processing = true;

  try {
    while (gq.updates.length > 0) {
      // Take the latest update, discard intermediates
      const skipped = gq.updates.length - 1;
      const latest = gq.updates[gq.updates.length - 1];
      gq.updates = [];

      if (skipped > 0) {
        console.log(`[Showcase Queue] Skipping ${skipped} intermediate update(s), sending move ${latest.moveNum}`);
      }

      // Retry loop: keep trying until success or daemon crash
      let success = false;
      while (!success) {
        try {
          const { txid } = await updateGameOnChain(
            latest.subIdName,
            latest.liveState,
            latest.keys,
            latest.parentIdentityName,
          );
          console.log(`[Showcase Queue] Updated ${latest.subIdName}, move ${latest.moveNum}, txid: ${txid}`);
          success = true;
        } catch (error: any) {
          if (isDaemonDown(error)) {
            console.error(`[Showcase Queue] Daemon unreachable for ${latest.subIdName}, stopping:`, error.code);
            return; // Stop all processing — daemon is down
          }

          console.warn(`[Showcase Queue] Failed for ${latest.subIdName} move ${latest.moveNum}:`, error.message);
          console.log(`[Showcase Queue] Waiting for next block before retry...`);

          try {
            await waitForNextBlock();
          } catch (waitError: any) {
            console.error(`[Showcase Queue] waitForNextBlock timed out, stopping:`, waitError.message);
            return;
          }

          // After waiting, check if newer state was queued while we waited
          if (gq.updates.length > 0) {
            const newerSkipped = gq.updates.length;
            latest.liveState = gq.updates[gq.updates.length - 1].liveState;
            latest.moveNum = gq.updates[gq.updates.length - 1].moveNum;
            gq.updates = [];
            console.log(`[Showcase Queue] Picked up ${newerSkipped} newer update(s), retrying with move ${latest.moveNum}`);
          }
        }
      }
    }
  } finally {
    gq.processing = false;
  }
}

// --- Public API ---

/**
 * Enqueue a chain update for a showcase game.
 * Called by the showcase handler on every move.
 * Triggers processing when the batch size is reached.
 */
export function enqueueChainUpdate(
  gameId: string,
  update: QueuedUpdate,
): void {
  let gq = gameQueues.get(gameId);
  if (!gq) {
    gq = { updates: [], processing: false, flushing: false };
    gameQueues.set(gameId, gq);
  }

  gq.updates.push(update);

  // Don't trigger processing if flush owns the drain
  if (gq.flushing) return;

  // Process when batch size reached and not already processing
  if (gq.updates.length >= BATCH_SIZE && !gq.processing) {
    processQueue(gameId).catch((err) =>
      console.error(`[Showcase Queue] processQueue error for ${gameId}:`, err.message)
    );
  }
}

/**
 * Flush any remaining queued updates for a game.
 * Called by storeOnChain at game end, before the final updateidentity.
 * Waits for any in-progress update to finish, then drains the queue.
 */
export async function flushQueue(gameId: string): Promise<void> {
  const gq = gameQueues.get(gameId);
  if (!gq) return;

  // Prevent enqueueChainUpdate from triggering new workers
  gq.flushing = true;

  // Wait for any in-progress update to finish
  while (gq.processing) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // Process any remaining updates
  if (gq.updates.length > 0) {
    await processQueue(gameId);
  }

  // Cleanup — any updates pushed after this point are intentionally discarded
  // because storeOnChain immediately writes the complete final state after flush
  gameQueues.delete(gameId);
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: build succeeds. The module is not imported yet, but it should compile cleanly.

- [ ] **Step 3: Commit**

```bash
git add app/utils/modes/showcase/chain-queue.ts
git commit -m "feat: add serial batch queue for showcase chain updates"
```

---

### Task 3: Wire Queue into Showcase Handler

**Files:**
- Modify: `app/utils/modes/showcase/handler.ts:1-9` (imports)
- Modify: `app/utils/modes/showcase/handler.ts:82-97` (onMove background chain update)
- Modify: `app/utils/modes/showcase/handler.ts:145-209` (storeOnChain)

- [ ] **Step 1: Add imports**

Add to the import block at the top of the file (after line 4):

```typescript
import { enqueueChainUpdate, flushQueue } from './chain-queue';
```

- [ ] **Step 2: Replace direct `updateGameOnChain` call in `onMove` with queue**

Replace lines 82-97 (the fire-and-forget background chain update):

```typescript
    // Before (lines 82-97):
    // Fire chain update in the background — don't block the move/socket relay
    (async () => {
      try {
        // Re-read session to get latest subIdAddress (may have been set by background registration)
        const freshSession = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
        if (!freshSession?.subIdAddress) {
          // SubID not ready yet — skip this move's chain update
          // The background registration from game creation will complete it
          console.log(`[Showcase] SubID ${subIdName} not ready yet, skipping chain update for move ${moveNum}`);
          return;
        }
        console.log(`[Showcase] Using SubID ${subIdName} (${freshSession.subIdAddress})`);
        await updateGameOnChain(subIdName, liveState, config.vdxfKeys, config.parentIdentityName);
      } catch (error: any) {
        console.error(`[Showcase] Live chain update failed for move ${moveNum}:`, error.message);
      }
    })();
```

Replace with:

```typescript
    // Enqueue chain update — don't block the move/socket relay
    (async () => {
      try {
        const freshSession = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
        if (!freshSession?.subIdAddress) {
          console.log(`[Showcase] SubID ${subIdName} not ready yet, skipping chain update for move ${moveNum}`);
          return;
        }
        enqueueChainUpdate(game.id, {
          subIdName,
          liveState,
          keys: config.vdxfKeys,
          parentIdentityName: config.parentIdentityName,
          moveNum,
        });
      } catch (error: any) {
        console.error(`[Showcase] Failed to enqueue chain update for move ${moveNum}:`, error.message);
      }
    })();
```

- [ ] **Step 3: Add `flushQueue` call to `storeOnChain`**

In the `storeOnChain` method, add `await flushQueue(game.id);` immediately before the `try` block that calls `updateGameOnChain` (line 194). This ensures any pending mid-game updates complete before the final state is written.

Insert after line 193 (after building `finalState`), before the `try {`:

```typescript
    // Drain any pending queued updates before the final store
    await flushQueue(game.id);
```

- [ ] **Step 4: Remove unused `updateGameOnChain` import if no longer used directly in onMove**

Check the imports at line 4. `updateGameOnChain` is still used directly in `storeOnChain` (line 195), so keep the import. No change needed.

- [ ] **Step 5: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/utils/modes/showcase/handler.ts
git commit -m "feat: showcase handler uses serial batch queue for chain updates"
```

---

### Task 4: Add Environment Variable

**Files:**
- Modify: `.env.example:53` (after SUBID_POOL_ENABLED)

- [ ] **Step 1: Add `SHOWCASE_BATCH_SIZE` to `.env.example`**

Append after the last line (line 53):

```
# Showcase mode: how many moves to batch before writing to chain (default: 3, range: 1-5)
SHOWCASE_BATCH_SIZE=3
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add SHOWCASE_BATCH_SIZE env var to .env.example"
```

---

### Task 5: Verify and Test

- [ ] **Step 1: Full build check**

```bash
npx next build 2>&1 | tail -10
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 2: Manual test — showcase game**

1. Start the server: `node server.js &` then `npx next dev`
2. Start a showcase game between two players (chess or checkers)
3. Watch the console — moves should batch:
   - Moves 1, 2: no `[Showcase Queue] Updated` log
   - Move 3: `[Showcase Queue] Updated ...` appears (batch sent)
   - If a batch fails: `[Showcase Queue] Waiting for next block before retry...` then retry
4. End the game — `flushQueue` should drain any remaining moves before the final store
5. Verify the SubID on chain has the complete game data

- [ ] **Step 3: Verify no regressions**

1. Play a normal mode game — should work exactly as before (queue is showcase-only)
2. Play a showcase game where SubID is still registering — moves should log `SubID not ready yet, skipping` (unchanged behavior)

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after showcase batch queue implementation"
```
