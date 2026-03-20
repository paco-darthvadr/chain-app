import { rpcCall, waitForConfirmation, buildSubIdFullName } from '@/app/utils/verus-rpc';

export async function createGameSubId(subIdName: string): Promise<{ address: string }> {
  const fullName = buildSubIdFullName(subIdName);

  // Check if SubID already exists
  try {
    const existing = await rpcCall('getidentity', [fullName]);
    if (existing && existing.identity) {
      console.log(`[SubID] ${fullName} already exists at ${existing.identity.identityaddress}`);
      return { address: existing.identity.identityaddress };
    }
  } catch (e) {
    // Identity doesn't exist — proceed to create
  }

  // Step 1: registernamecommitment
  // Params: name, controladdress, referralidentity, parentnameorid, sourceoffunds
  const parentAddress = process.env.CHESSGAME_IDENTITY_ADDRESS;
  let commitment;
  try {
    commitment = await rpcCall('registernamecommitment', [
      subIdName,
      parentAddress,
      '',
      parentAddress,
    ]);
    console.log(`[SubID] Name commitment for ${fullName}:`, commitment);
  } catch (e: any) {
    // Commitment may already exist from game-start fire-and-forget
    // Try to find a recent unspent commitment in the mempool
    console.log(`[SubID] Commitment failed (may already exist): ${e.message}`);
    throw new Error(`SubID commitment failed for ${fullName}: ${e.message}. The commitment may not be mined yet — try again in ~60 seconds.`);
  }

  // Step 2: wait for commitment to be mined
  console.log(`[SubID] Waiting for commitment ${commitment.txid.substring(0, 16)}... to be mined...`);
  const confirmed = await waitForConfirmation(commitment.txid, 120000);
  if (!confirmed) {
    throw new Error(`SubID commitment for ${fullName} not confirmed after 2 minutes. Try again later.`);
  }

  // Step 3: registeridentity
  // Get the parent identity to find its primary R-address for the SubID
  const parentIdentity = await rpcCall('getidentity', [parentAddress]);
  const parentPrimaryAddress = parentIdentity.identity.primaryaddresses[0];

  const identity = await rpcCall('registeridentity', [{
    txid: commitment.txid,
    namereservation: commitment.namereservation,
    identity: {
      name: subIdName,
      parent: parentAddress,
      primaryaddresses: [parentPrimaryAddress],
      minimumsignatures: 1,
    },
  }]);
  console.log(`[SubID] Registered ${fullName}, txid:`, identity);

  // Try to get the identity address immediately (may be in mempool)
  // If not found yet, wait briefly for it to be mined
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const registered = await rpcCall('getidentity', [fullName]);
      if (registered?.identity?.identityaddress) {
        return { address: registered.identity.identityaddress };
      }
    } catch (e) {
      // Not found yet
    }
    if (attempt < 5) {
      console.log(`[SubID] ${fullName} not found yet, waiting 10s... (${attempt + 1}/6)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  // Return the nameid from the commitment as fallback
  const nameid = commitment.namereservation?.nameid;
  if (nameid) {
    console.log(`[SubID] ${fullName} not confirmed yet, using nameid: ${nameid}`);
    return { address: nameid };
  }

  throw new Error(`${fullName} registered but not yet visible on chain. Try storing again in ~60s.`);
}

export interface GameData {
  white: string;
  black: string;
  winner: string;
  result: string;        // "checkmate", "stalemate", "resignation", "timeout"
  moves: string[];
  moveCount: number;
  duration: number;       // seconds
  startedAt: number;      // unix timestamp
  gameHash: string;
  whiteSig: string;
  blackSig: string;
  mode: string;           // "normal", "tournament"
  moveSigs?: string[];    // per-move signatures (tournament mode or user opt-in)
}

/**
 * Update a game SubID's contentmultimap with final game data.
 */
export async function storeGameData(subIdName: string, data: GameData): Promise<{ txid: string }> {
  const { CHESS_VDXF_KEYS } = await import('./vdxf-keys');
  const { dd } = await import('@/app/utils/data-descriptor');

  const fullName = buildSubIdFullName(subIdName);

  // Get the current identity
  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  // Build contentmultimap with DataDescriptor-wrapped values per field
  const K = CHESS_VDXF_KEYS;
  const contentmultimap: Record<string, object[]> = {
    [K.version.vdxfid]:   [dd('1',                         K.version.uri)],
    [K.white.vdxfid]:     [dd(data.white,                  K.white.uri)],
    [K.black.vdxfid]:     [dd(data.black,                  K.black.uri)],
    [K.winner.vdxfid]:    [dd(data.winner,                 K.winner.uri)],
    [K.result.vdxfid]:    [dd(data.result,                 K.result.uri)],
    [K.moves.vdxfid]:     [dd(JSON.stringify(data.moves),  K.moves.uri, 'application/json')],
    [K.movecount.vdxfid]: [dd(String(data.moveCount),      K.movecount.uri)],
    [K.duration.vdxfid]:  [dd(String(data.duration),       K.duration.uri + ' (seconds)')],
    [K.startedat.vdxfid]: [dd(String(data.startedAt),      K.startedat.uri)],
    [K.gamehash.vdxfid]:  [dd(data.gameHash,               K.gamehash.uri)],
    [K.whitesig.vdxfid]:  [dd(data.whiteSig,               K.whitesig.uri)],
    [K.blacksig.vdxfid]:  [dd(data.blackSig,               K.blacksig.uri)],
    [K.mode.vdxfid]:      [dd(data.mode,                   K.mode.uri)],
  };

  // Include per-move signatures if provided (tournament mode or user opt-in)
  if (data.moveSigs && data.moveSigs.length > 0) {
    contentmultimap[K.movesigs.vdxfid] = [dd(JSON.stringify(data.moveSigs), K.movesigs.uri, 'application/json')];
  }

  // Update identity with game data
  const updateParams = {
    ...identity,
    contentmultimap,
  };

  const txid = await rpcCall('updateidentity', [updateParams]);
  console.log(`[SubID] Updated ${fullName} with game data, txid:`, txid);

  return { txid };
}
