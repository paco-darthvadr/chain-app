import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { buildOpeningMessage, verifyOpeningSignature, OpeningCommitment } from '@/app/utils/modes/showcase/opening-commitment';
import { rpcCall, getPlayerName } from '@/app/utils/verus-rpc';

function buildCommitment(game: any): OpeningCommitment {
  return {
    white: getPlayerName(game.player1),
    black: getPlayerName(game.player2),
    gameNumber: game.gameSession?.subIdName || game.id,
    startedAt: game.createdAt.toISOString(),
  };
}

// GET /api/game/[gameId]/showcase-sign — get the opening message to sign
export async function GET(request: Request, { params }: { params: { gameId: string } }) {
  try {
    const game = await prisma.game.findUnique({
      where: { id: params.gameId },
      include: { player1: true, player2: true, gameSession: true },
    });

    if (!game || (game.mode !== 'showcase' && game.mode !== 'normal')) {
      return NextResponse.json({ error: 'Game mode does not support signatures' }, { status: 404 });
    }

    const commitment = buildCommitment(game);
    const message = buildOpeningMessage(commitment);

    return NextResponse.json({
      message,
      commitment,
      player1HasSigned: !!game.gameSession?.player1OpeningSig,
      player2HasSigned: !!game.gameSession?.player2OpeningSig,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/game/[gameId]/showcase-sign
// Body: { phase: "open" | "close", player: "white" | "black", signature: string }
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  try {
    const { phase, player, signature } = await request.json();

    if (!phase || !player || !signature) {
      return NextResponse.json({ error: 'Missing phase, player, or signature' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: params.gameId },
      include: { player1: true, player2: true, gameSession: true },
    });

    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    if (game.mode !== 'showcase' && game.mode !== 'normal') return NextResponse.json({ error: 'Game mode does not support signatures' }, { status: 400 });

    const session = game.gameSession;
    if (!session) return NextResponse.json({ error: 'No game session' }, { status: 400 });

    const playerUser = player === 'white' ? game.player1 : game.player2;
    const playerName = getPlayerName(playerUser);

    // Auth check: verify the caller matches the player they claim to be (fix #4/#7)
    const callerUserId = request.headers.get('x-user-id') || '';
    const expectedPlayerId = player === 'white' ? game.player1Id : game.player2Id;
    // If we have a caller ID, enforce it matches
    if (callerUserId && callerUserId !== expectedPlayerId) {
      return NextResponse.json({ error: 'You can only sign as your own player' }, { status: 403 });
    }

    if (phase === 'open') {
      const commitment = buildCommitment(game);
      const isValid = await verifyOpeningSignature(playerName, signature, commitment);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Store in dedicated opening sig columns (fix #1)
      const sigField = player === 'white' ? 'player1OpeningSig' : 'player2OpeningSig';
      await prisma.gameSession.update({
        where: { gameId: params.gameId },
        data: { [sigField]: signature },
      });

      const updatedSession = await prisma.gameSession.findUnique({
        where: { gameId: params.gameId },
      });
      const bothSigned = !!updatedSession?.player1OpeningSig && !!updatedSession?.player2OpeningSig;

      return NextResponse.json({
        success: true,
        phase: 'open',
        player,
        bothSigned,
        message: buildOpeningMessage(commitment),
      });

    } else if (phase === 'close') {
      if (!session.gameHash) {
        return NextResponse.json({ error: 'Game hash not computed yet' }, { status: 400 });
      }

      const isValid = await rpcCall('verifymessage', [playerName, signature, session.gameHash]);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid closing signature' }, { status: 401 });
      }

      // Store in closing sig columns — separate from opening sigs (fix #1)
      const sigField = player === 'white' ? 'player1FinalSig' : 'player2FinalSig';
      await prisma.gameSession.update({
        where: { gameId: params.gameId },
        data: { [sigField]: signature },
      });

      return NextResponse.json({ success: true, phase: 'close', player });

    } else {
      return NextResponse.json({ error: 'Invalid phase — use "open" or "close"' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[showcase-sign] Error:', error);
    return NextResponse.json({ error: error.message || 'Signature submission failed' }, { status: 500 });
  }
}
