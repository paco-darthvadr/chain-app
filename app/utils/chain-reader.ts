import { getGameConfig } from '@/app/games/registry';
import { DD_KEY } from '@/app/utils/data-descriptor';
import { rpcCall, buildSubIdFullName } from './verus-rpc';

/**
 * Build a reverse lookup: vdxfid -> field name
 */
function buildKeyLookup(gameType: string = 'chess'): Record<string, string> {
  const config = getGameConfig(gameType);
  const lookup: Record<string, string> = {};
  for (const [field, def] of Object.entries(config.vdxfKeys)) {
    lookup[(def as { vdxfid: string }).vdxfid] = field;
  }
  return lookup;
}

/**
 * Extract the value from a DataDescriptor entry.
 * Handles both text/plain (objectdata.message) and application/json (hex-encoded objectdata).
 */
function extractDDValue(entry: any): { value: string; mimetype: string; label: string } {
  const dd = entry[DD_KEY];
  if (!dd) return { value: '', mimetype: '', label: '' };

  const mimetype = dd.mimetype || 'text/plain';
  const label = dd.label || '';

  let value: string;
  if (typeof dd.objectdata === 'string') {
    // application/json — daemon stores as hex-encoded bytes
    value = Buffer.from(dd.objectdata, 'hex').toString('utf8');
  } else if (dd.objectdata?.message !== undefined) {
    // text/plain — daemon preserves { message: "..." }
    value = dd.objectdata.message;
  } else {
    value = JSON.stringify(dd.objectdata);
  }

  return { value, mimetype, label };
}

export interface OnChainGame {
  subIdName: string;
  fullName: string;
  identityAddress: string;
  blockheight: number;
  txid: string;
  gameType: string;
  version: string;
  player1: string;
  player2: string;
  player1Name: string | null;
  player2Name: string | null;
  winner: string;
  winnerName: string | null;
  result: string;
  moves: string[];
  moveCount: number;
  duration: number;
  startedAt: number;
  gameHash: string;
  player1Sig: string;
  player2Sig: string;
  mode: string;
  moveSigs: string[] | null;
  // Showcase mode fields
  player1OpenSig: string | null;
  player2OpenSig: string | null;
  status: string | null;
}

/**
 * Resolve a Verus i-address to its friendly name (e.g. "player@").
 * Returns null if not resolvable.
 */
async function resolveIdentityName(iAddress: string): Promise<string | null> {
  try {
    const result = await rpcCall('getidentity', [iAddress]);
    return result?.identity?.name
      ? `${result.identity.name}@`
      : null;
  } catch {
    return null;
  }
}

/**
 * Fetch and parse a game's on-chain data from its SubID.
 */
export async function readGameFromChain(subIdName: string, gameType: string = 'chess'): Promise<OnChainGame | null> {
  const config = getGameConfig(gameType);
  const fullName = buildSubIdFullName(subIdName, config.parentIdentityName);

  let identityResult;
  try {
    identityResult = await rpcCall('getidentity', [fullName]);
  } catch {
    return null;
  }

  const identity = identityResult?.identity;
  if (!identity?.contentmultimap) return null;

  const cmm = identity.contentmultimap;
  const keyLookup = buildKeyLookup(gameType);

  // Parse all fields from contentmultimap
  const fields: Record<string, string> = {};
  for (const [vdxfid, entries] of Object.entries(cmm)) {
    const fieldName = keyLookup[vdxfid];
    if (!fieldName || !Array.isArray(entries) || entries.length === 0) continue;
    const { value } = extractDDValue(entries[0]);
    fields[fieldName] = value;
  }

  // If no game fields found, SubID exists but has no game data
  if (!fields.version) return null;

  // Parse structured fields
  let moves: string[] = [];
  try {
    moves = JSON.parse(fields.moves || '[]');
  } catch {
    moves = [];
  }

  let moveSigs: string[] | null = null;
  if (fields.movesigs) {
    try {
      moveSigs = JSON.parse(fields.movesigs);
    } catch {
      moveSigs = null;
    }
  }

  // Resolve i-addresses to friendly names
  const [player1Name, player2Name, winnerName] = await Promise.all([
    fields.player1 ? resolveIdentityName(fields.player1) : null,
    fields.player2 ? resolveIdentityName(fields.player2) : null,
    fields.winner ? resolveIdentityName(fields.winner) : null,
  ]);

  return {
    subIdName,
    fullName,
    identityAddress: identity.identityaddress,
    blockheight: identityResult.blockheight,
    txid: identityResult.txid,
    gameType,
    version: fields.version || '',
    player1: fields.player1 || '',
    player2: fields.player2 || '',
    player1Name,
    player2Name,
    winner: fields.winner || '',
    winnerName,
    result: fields.result || '',
    moves,
    moveCount: parseInt(fields.movecount || '0', 10),
    duration: parseInt(fields.duration || '0', 10),
    startedAt: parseInt(fields.startedat || '0', 10),
    gameHash: fields.gamehash || '',
    player1Sig: fields.player1sig || '',
    player2Sig: fields.player2sig || '',
    mode: fields.mode || 'normal',
    moveSigs,
    // Showcase mode fields
    player1OpenSig: fields.player1opensig || null,
    player2OpenSig: fields.player2opensig || null,
    status: fields.status || null,
  };
}

/**
 * Discover all game SubIDs under the parent identity by iterating the counter.
 * Returns games that exist on chain and have data stored.
 */
export async function listGamesFromChain(gameType: string = 'chess'): Promise<OnChainGame[]> {
  const config = getGameConfig(gameType);

  // Find the highest game number by checking the DB counter
  // Fallback: probe up to a reasonable max
  let maxGame = 20;
  try {
    const { prisma } = await import('@/lib/prisma');
    const counter = await prisma.gameCounter.findUnique({ where: { id: gameType } });
    if (counter) maxGame = counter.nextGame;
  } catch {
    // DB not available, probe manually
  }

  const games: OnChainGame[] = [];
  const promises: Promise<void>[] = [];

  for (let i = 1; i < maxGame; i++) {
    const subIdName = `${config.subIdPrefix}${String(i).padStart(4, '0')}`;
    promises.push(
      readGameFromChain(subIdName, gameType).then(game => {
        if (game) games.push(game);
      }).catch(() => {
        // SubID doesn't exist or has no data
      })
    );
  }

  await Promise.all(promises);

  // Sort by game number
  games.sort((a, b) => {
    const numA = parseInt(a.subIdName.replace(/\D/g, ''), 10);
    const numB = parseInt(b.subIdName.replace(/\D/g, ''), 10);
    return numA - numB;
  });

  return games;
}
