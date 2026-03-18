import { ModeHandler, MoveData, SignedMovePackage, GameEndResult, StorageResult } from '../types';

// Original mode does not sign moves or manage hash chains.
// It delegates blockchain storage to the existing BlockchainStorage class
// via the store-blockchain API route (which handles it directly).
// onMove and onGameEnd are no-ops for this mode.

export const originalHandler: ModeHandler = {
  async onMove(game: any, moveData: MoveData): Promise<SignedMovePackage | null> {
    // Original mode has no per-move signing
    return null;
  },

  async onGameEnd(game: any): Promise<GameEndResult | null> {
    // Original mode has no post-game verification step
    return null;
  },

  async storeOnChain(game: any): Promise<StorageResult> {
    // Original mode storage is handled directly by the existing
    // store-blockchain route using BlockchainStorage class.
    // This handler is a passthrough — the route checks for original mode
    // and calls the existing code path directly.
    return { success: true };
  },
};
