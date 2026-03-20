'use server';

import { prisma } from '@/lib/prisma';

export async function getGames() {
  const games = await prisma.game.findMany({
    include: {
      player1: true,
      player2: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return games;
}
