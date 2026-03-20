import { CHESS_VDXF_KEYS } from '../normal/vdxf-keys';
import { dd } from '@/app/utils/data-descriptor';
import { rpcCall, buildSubIdFullName } from '@/app/utils/verus-rpc';

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
function buildContentMultimap(state: LiveGameState): Record<string, object[]> {
  const K = CHESS_VDXF_KEYS;

  const cmm: Record<string, object[]> = {
    [K.version.vdxfid]:      [dd('1',                              K.version.uri)],
    [K.white.vdxfid]:        [dd(state.white,                      K.white.uri)],
    [K.black.vdxfid]:        [dd(state.black,                      K.black.uri)],
    [K.moves.vdxfid]:        [dd(JSON.stringify(state.moves),      K.moves.uri, 'application/json')],
    [K.movecount.vdxfid]:    [dd(String(state.moveCount),          K.movecount.uri)],
    [K.startedat.vdxfid]:    [dd(String(state.startedAt),          K.startedat.uri)],
    [K.mode.vdxfid]:         [dd(state.mode,                       K.mode.uri)],
    [K.status.vdxfid]:       [dd(state.status,                     K.status.uri)],
    [K.whiteopensig.vdxfid]: [dd(state.whiteOpenSig,               K.whiteopensig.uri)],
    [K.blackopensig.vdxfid]: [dd(state.blackOpenSig,               K.blackopensig.uri)],
  };

  // Add game-end fields when available
  if (state.winner)   cmm[K.winner.vdxfid]   = [dd(state.winner,             K.winner.uri)];
  if (state.result)   cmm[K.result.vdxfid]    = [dd(state.result,             K.result.uri)];
  if (state.gameHash) cmm[K.gamehash.vdxfid]  = [dd(state.gameHash,           K.gamehash.uri)];
  if (state.whiteSig) cmm[K.whitesig.vdxfid]  = [dd(state.whiteSig,           K.whitesig.uri)];
  if (state.blackSig) cmm[K.blacksig.vdxfid]  = [dd(state.blackSig,           K.blacksig.uri)];
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
): Promise<{ txid: string }> {
  const fullName = buildSubIdFullName(subIdName);

  // Get current identity to preserve non-game fields
  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  const contentmultimap = buildContentMultimap(state);

  const updateParams = {
    ...identity,
    contentmultimap,
  };

  const txid = await rpcCall('updateidentity', [updateParams]);
  console.log(`[Showcase] Updated ${fullName}, move ${state.moveCount}, txid:`, txid);

  return { txid };
}

