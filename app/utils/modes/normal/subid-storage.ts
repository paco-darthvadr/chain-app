import axios from 'axios';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

/**
 * Make a JSON-RPC call to the Verus daemon.
 */
async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method,
    params,
    id: 1,
    jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

/**
 * Register a SubID under ChessGame@ for a completed game.
 * Uses registernamecommitment + registeridentity two-step process.
 */
/**
 * Helper to wait for a commitment tx to be mined.
 * Polls getrawtransaction confirmations every 10s, up to maxWait ms.
 */
async function waitForConfirmation(txid: string, maxWait: number = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const tx = await rpcCall('getrawtransaction', [txid, 1]);
      if (tx && tx.confirmations && tx.confirmations > 0) {
        console.log(`[SubID] TX ${txid.substring(0, 16)}... confirmed (${tx.confirmations} conf)`);
        return true;
      }
    } catch (e) {
      // TX not found yet, keep waiting
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  return false;
}

export async function createGameSubId(subIdName: string): Promise<{ address: string }> {
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  const fullName = `${subIdName}.${parentName.replace('@', '')}@`;

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
  const identity = await rpcCall('registeridentity', [{
    txid: commitment.txid,
    namereservation: commitment.namereservation,
    identity: {
      name: subIdName,
      parent: parentAddress,
      primaryaddresses: [parentAddress],
      minimumsignatures: 1,
    },
  }]);
  console.log(`[SubID] Registered ${fullName}:`, identity);

  // Get the identity address
  const registered = await rpcCall('getidentity', [fullName]);
  return { address: registered.identity.identityaddress };
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
}

/**
 * Update a game SubID's contentmultimap with final game data.
 * NOTE: Uses DATA_TYPE_STRING.vdxfid as the value wrapper to match the existing
 * codebase pattern in blockchain-storage.js. The outer key is a placeholder —
 * replace with proper VDXF key IDs (i-addresses from getvdxfid) when the user creates
 * the ChessGame@ identity and registers the VDXF namespace.
 * Until then, this will NOT work against a real Verus daemon — RPC expects VDXF key IDs.
 */
export async function storeGameData(subIdName: string, data: GameData): Promise<{ txid: string }> {
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  const fullName = `${subIdName}.${parentName.replace('@', '')}@`;

  // Get the current identity
  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  // Build contentmultimap with game data.
  // Using DATA_TYPE_STRING.vdxfid as the value wrapper to match the existing
  // codebase pattern in blockchain-storage.js.
  const { DATA_TYPE_STRING } = require('verus-typescript-primitives/dist/vdxf/keys');
  const vdxfKey = DATA_TYPE_STRING.vdxfid;

  // Serialize all game data as a single JSON blob under one VDXF key
  const gameBlob = JSON.stringify({
    white: data.white,
    black: data.black,
    winner: data.winner,
    result: data.result,
    moves: data.moves,
    moveCount: data.moveCount,
    duration: data.duration,
    startedAt: data.startedAt,
    gameHash: data.gameHash,
    whiteSig: data.whiteSig,
    blackSig: data.blackSig,
  });
  const gameDataHex = Buffer.from(gameBlob).toString('hex');

  const contentmultimap = {
    [vdxfKey]: [{ [vdxfKey]: gameDataHex }],
  };

  // Update identity with game data
  const updateParams = {
    ...identity,
    contentmultimap,
  };

  const txid = await rpcCall('updateidentity', [updateParams]);
  console.log(`[SubID] Updated ${fullName} with game data, txid:`, txid);

  return { txid };
}
