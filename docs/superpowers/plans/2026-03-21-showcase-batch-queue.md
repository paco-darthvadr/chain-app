# Showcase Mode: Serial Batch Queue for Chain Updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-move `updateidentity` calls in showcase mode with a serial queue that batches every N moves (configurable via env var), eliminating the concurrent RPC 500 errors.

**Architecture:** A per-game queue accumulates moves. Every `SHOWCASE_BATCH_SIZE` moves (env var, default 3), the queue worker fires ONE `updateidentity` with the latest accumulated game state. The worker processes sequentially — each update must complete before the next starts. Remaining queued updates flush at game end.

**Tech Stack:** Next.js 14, TypeScript, Verus RPC

---

### Task 1: Create the Chain Update Queue

**Files:**
- Create: `app/utils/modes/showcase/chain-queue.ts`

- [ ] **Step 1: Design the queue interface**

```typescript
// app/utils/modes/showcase/chain-queue.ts

import type { VDXFKeySet } from '@/app/games/types';

interface QueuedUpdate {
  subIdName: string;
  liveState: any;          // LiveGameState
  keys: VDXFKeySet;
  parentIdentityName: string;
  moveNum: number;
}

interface GameQueue {
  queue: QueuedUpdate[];
  processing: boolean;
  batchSize: number;
}

const gameQueues: Map<string, GameQueue> = new Map();
```

- [ ] **Step 2: Implement `enqueueChainUpdate`**

Called by the showcase handler on every move. Adds the update to the queue and triggers processing if the batch size is reached.

```typescript
export function enqueueChainUpdate(
  gameId: string,
  update: QueuedUpdate,
): void {
  const batchSize = parseInt(process.env.SHOWCASE_BATCH_SIZE || '3', 10);

  let gq = gameQueues.get(gameId);
  if (!gq) {
    gq = { queue: [], processing: false, batchSize };
    gameQueues.set(gameId, gq);
  }

  gq.queue.push(update);

  // Process when batch size reached
  if (gq.queue.length >= gq.batchSize && !gq.processing) {
    processQueue(gameId);
  }
}
```

- [ ] **Step 3: Implement `processQueue`**

Serial worker that processes one update at a time. Only sends the LATEST state (not intermediate states) since `updateidentity` overwrites the contentmultimap.

```typescript
async function processQueue(gameId: string): Promise<void> {
  const gq = gameQueues.get(gameId);
  if (!gq || gq.processing || gq.queue.length === 0) return;

  gq.processing = true;

  try {
    while (gq.queue.length > 0) {
      // Take the latest update (skip intermediate states)
      const latest = gq.queue[gq.queue.length - 1];
      gq.queue = []; // Clear queue — we're sending the latest state

      try {
        await updateGameOnChain(
          latest.subIdName,
          latest.liveState,
          latest.keys,
          latest.parentIdentityName,
        );
        console.log(`[Showcase Queue] Updated ${latest.subIdName}, move ${latest.moveNum}`);
      } catch (error: any) {
        console.error(`[Showcase Queue] Failed for ${latest.subIdName} move ${latest.moveNum}:`, error.message);
        // Don't retry — next batch will send the latest state anyway
      }
    }
  } finally {
    gq.processing = false;
  }
}
```

- [ ] **Step 4: Implement `flushQueue`**

Called at game end to send any remaining queued updates.

```typescript
export async function flushQueue(gameId: string): Promise<void> {
  const gq = gameQueues.get(gameId);
  if (!gq || gq.queue.length === 0) return;

  // Wait for any in-progress update to finish
  while (gq.processing) {
    await new Promise(r => setTimeout(r, 100));
  }

  // Process remaining
  if (gq.queue.length > 0) {
    await processQueue(gameId);
  }

  // Cleanup
  gameQueues.delete(gameId);
}
```

- [ ] **Step 5: Commit**

```bash
git add app/utils/modes/showcase/chain-queue.ts
git commit -m "feat: add serial batch queue for showcase chain updates"
```

---

### Task 2: Wire Queue into Showcase Handler

**Files:**
- Modify: `app/utils/modes/showcase/handler.ts`

- [ ] **Step 1: Replace direct `updateGameOnChain` call with queue**

In the `onMove` method, replace the background `updateGameOnChain` call:

```typescript
// Before (current):
(async () => {
  const freshSession = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
  if (!freshSession?.subIdAddress) {
    console.log(`[Showcase] SubID ${subIdName} not ready yet, skipping`);
    return;
  }
  await updateGameOnChain(subIdName, liveState, config.vdxfKeys, config.parentIdentityName);
})();

// After:
(async () => {
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
})();
```

- [ ] **Step 2: Flush queue in `storeOnChain`**

Before the final `updateidentity` in `storeOnChain`, flush any remaining queued updates:

```typescript
await flushQueue(game.id);
```

- [ ] **Step 3: Add import**

```typescript
import { enqueueChainUpdate, flushQueue } from './chain-queue';
```

- [ ] **Step 4: Verify build and test**

```bash
npx next build
```

Test: play a showcase checkers game. Moves should batch — console should show updates every N moves instead of every single move. No 500 errors.

- [ ] **Step 5: Commit**

```bash
git add app/utils/modes/showcase/handler.ts
git commit -m "feat: showcase handler uses serial batch queue for chain updates"
```

---

### Task 3: Add Environment Variable

**Files:**
- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: Add `SHOWCASE_BATCH_SIZE` to `.env.example`**

```
# Showcase mode: how many moves to batch before writing to chain (default: 3)
SHOWCASE_BATCH_SIZE=3
```

- [ ] **Step 2: Add to `.env`**

Same value.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add SHOWCASE_BATCH_SIZE env var"
```
