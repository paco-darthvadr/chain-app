import { prisma } from '@/lib/prisma';

/**
 * Atomically allocate the next game number from the shared GameCounter.
 * Returns the game number and the formatted SubID name (e.g. "game0017").
 * Safe for SQLite — uses INSERT OR IGNORE + transactional UPDATE.
 */
export async function nextGameNumber(): Promise<{ gameNumber: number; subIdName: string }> {
  await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES ('singleton', 1)`;
  const gameNumber = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = 'singleton'`;
    const result = await tx.gameCounter.findUnique({ where: { id: 'singleton' } });
    return result!.nextGame - 1;
  });
  const subIdName = `game${String(gameNumber).padStart(4, '0')}`;
  return { gameNumber, subIdName };
}
