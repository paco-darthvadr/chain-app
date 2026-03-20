import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const games = await prisma.game.findMany({
    include: {
      player1: true,
      player2: true,
      gameSession: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(games);
}
