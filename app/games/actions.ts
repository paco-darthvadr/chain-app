'use server';

import { prisma } from '@/lib/prisma';

export async function getGames() {
  const games = await prisma.game.findMany({
    include: {
      whitePlayer: true,
      blackPlayer: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return games;
} 