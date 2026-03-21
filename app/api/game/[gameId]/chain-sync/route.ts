import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const session = await prisma.gameSession.findUnique({
    where: { gameId },
  });

  const totalMoves = await prisma.move.count({ where: { gameId } });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { mode: true },
  });

  return NextResponse.json({
    syncedMoves: session?.chainSyncedMoveCount ?? 0,
    totalMoves,
    mode: game?.mode ?? 'normal',
  });
}
