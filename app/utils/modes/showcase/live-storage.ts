import { dd } from '@/app/utils/data-descriptor';
import { rpcCall, buildSubIdFullName } from '@/app/utils/verus-rpc';
import type { VDXFKeySet } from '@/app/games/types';

export interface LiveGameState {
  white: string;
  black: string;
  moves: string[];
  moveCount: number;
  startedAt: number;
  mode: string;
  status: string;
  whiteOpenSig: string;
  blackOpenSig: string;
  // Populated at game end
  winner?: string;
  result?: string;
  duration?: number;
  gameHash?: string;
  whiteSig?: string;
  blackSig?: string;
  moveSigs?: string[];
}

/**
 * Build contentmultimap from the current live game state.
 * Called on every move to update the SubID.
 */
function buildContentMultimap(state: LiveGameState, keys: VDXFKeySet): Record<string, object[]> {
  const K = keys;

  const cmm: Record<string, object[]> = {
    [K.version.vdxfid]:        [dd('1',                              K.version.uri)],
    [K.player1.vdxfid]:        [dd(state.white,                      K.player1.uri)],
    [K.player2.vdxfid]:        [dd(state.black,                      K.player2.uri)],
    [K.moves.vdxfid]:          [dd(JSON.stringify(state.moves),      K.moves.uri, 'application/json')],
    [K.movecount.vdxfid]:      [dd(String(state.moveCount),          K.movecount.uri)],
    [K.startedat.vdxfid]:      [dd(String(state.startedAt),          K.startedat.uri)],
    [K.mode.vdxfid]:           [dd(state.mode,                       K.mode.uri)],
    [K.status.vdxfid]:         [dd(state.status,                     K.status.uri)],
    [K.player1opensig.vdxfid]: [dd(state.whiteOpenSig,               K.player1opensig.uri)],
    [K.player2opensig.vdxfid]: [dd(state.blackOpenSig,               K.player2opensig.uri)],
  };

  // Add game-end fields when available
  if (state.winner)   cmm[K.winner.vdxfid]     = [dd(state.winner,             K.winner.uri)];
  if (state.result)   cmm[K.result.vdxfid]      = [dd(state.result,             K.result.uri)];
  if (state.gameHash) cmm[K.gamehash.vdxfid]    = [dd(state.gameHash,           K.gamehash.uri)];
  if (state.whiteSig) cmm[K.player1sig.vdxfid]  = [dd(state.whiteSig,           K.player1sig.uri)];
  if (state.blackSig) cmm[K.player2sig.vdxfid]  = [dd(state.blackSig,           K.player2sig.uri)];
  if (state.duration !== undefined) {
    cmm[K.duration.vdxfid] = [dd(String(state.duration), K.duration.uri + ' (seconds)')];
  }
  if (state.moveSigs && state.moveSigs.length > 0) {
    cmm[K.movesigs.vdxfid] = [dd(JSON.stringify(state.moveSigs), K.movesigs.uri, 'application/json')];
  }

  return cmm;
}

/**
 * Update the game SubID with the current game state.
 * Returns the txid immediately (tx goes to mempool).
 */
export async function updateGameOnChain(
  subIdName: string,
  state: LiveGameState,
  keys: VDXFKeySet,
  parentIdentityName?: string,
): Promise<{ txid: string }> {
  const fullName = buildSubIdFullName(subIdName, parentIdentityName);

  // Get current identity to preserve non-game fields
  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  const contentmultimap = buildContentMultimap(state, keys);

  const updateParams = {
    ...identity,
    contentmultimap,
  };

  const txid = await rpcCall('updateidentity', [updateParams]);
  console.log(`[Showcase] Updated ${fullName}, move ${state.moveCount}, txid:`, txid);

  return { txid };
}

