import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rpcCall } from '@/app/utils/verus-rpc';

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

  const sentMoves = session?.chainSentMoveCount ?? 0;
  let confirmedMoves = session?.chainConfirmedMoveCount ?? 0;

  // Lazily check if the latest batch tx is confirmed
  if (session?.chainLastTxId && confirmedMoves < sentMoves) {
    try {
      const tx = await rpcCall('getrawtransaction', [session.chainLastTxId, 1]);
      if (tx?.confirmations > 0) {
        // Latest tx confirmed — all sent moves are confirmed
        confirmedMoves = sentMoves;
        await prisma.gameSession.update({
          where: { gameId },
          data: { chainConfirmedMoveCount: confirmedMoves },
        });
      }
    } catch {
      // Tx not found or RPC error — keep existing confirmed count
    }
  }

  return NextResponse.json({
    sentMoves,
    confirmedMoves,
    totalMoves,
    mode: game?.mode ?? 'normal',
  });
}
