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
  return code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT'
      || code === 'EHOSTUNREACH' || code === 'ENETUNREACH';
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
      let latest = gq.updates[gq.updates.length - 1];
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
            latest = gq.updates[gq.updates.length - 1];
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
