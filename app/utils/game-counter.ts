import { prisma } from '@/lib/prisma';
import { rpcCall, buildSubIdFullName } from '@/app/utils/verus-rpc';
import { getGameConfig } from '@/app/games/registry';

/**
 * Check if a SubID already exists on-chain via getidentity.
 */
async function subIdExistsOnChain(subIdName: string, parentIdentityName: string): Promise<boolean> {
  try {
    const fullName = buildSubIdFullName(subIdName, parentIdentityName);
    await rpcCall('getidentity', [fullName]);
    return true; // No error = identity exists
  } catch {
    return false; // Error = identity doesn't exist
  }
}

/**
 * Atomically allocate the next game number from a per-game-type GameCounter.
 * Returns the game number and the formatted SubID name (e.g. "game0017").
 * Safe for SQLite — uses INSERT OR IGNORE + transactional UPDATE.
 *
 * Verifies the SubID doesn't already exist on-chain (handles DB counter
 * being out of sync with on-chain state, e.g. after a DB reset).
 */
export async function nextGameNumber(
  gameType: string = 'chess',
  prefix: string = 'game'
): Promise<{ gameNumber: number; subIdName: string }> {
  const config = getGameConfig(gameType);

  // Keep incrementing until we find a SubID that doesn't exist on-chain
  let attempts = 0;
  const maxAttempts = 50; // Safety valve

  while (attempts < maxAttempts) {
    await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES (${gameType}, 1)`;
    const gameNumber = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = ${gameType}`;
      const result = await tx.gameCounter.findUnique({ where: { id: gameType } });
      return result!.nextGame - 1;
    });
    const subIdName = `${prefix}${String(gameNumber).padStart(4, '0')}`;

    // Check if this SubID already exists on-chain
    const exists = await subIdExistsOnChain(subIdName, config.parentIdentityName);
    if (!exists) {
      return { gameNumber, subIdName };
    }

    console.log(`[GameCounter] ${subIdName}.${config.parentIdentityName} already exists on-chain, skipping to next`);
    attempts++;
  }

  throw new Error(`[GameCounter] Failed to find available SubID after ${maxAttempts} attempts for ${gameType}`);
}
