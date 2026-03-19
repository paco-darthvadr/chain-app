import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getModeHandler } from '@/app/utils/modes/mode-resolver';

// POST /api/game/[gameId]/verify — Run game-end verification (hash chain + signatures)
// Does NOT store on blockchain — just verifies and updates GameSession
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
    try {
        const game = await prisma.game.findUnique({
            where: { id: params.gameId },
            include: { whitePlayer: true, blackPlayer: true, gameSession: true },
        });

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'COMPLETED') {
            return NextResponse.json({ error: 'Game is not completed' }, { status: 400 });
        }

        if (game.mode !== 'normal' && game.mode !== 'showcase') {
            return NextResponse.json({ error: 'Verification only applies to Normal and Showcase modes' }, { status: 400 });
        }

        // Check if already verified
        if (game.gameSession?.verifiedAt) {
            return NextResponse.json({
                success: true,
                gameSession: game.gameSession,
            });
        }

        // Run verification using the correct mode handler
        const handler = getModeHandler(game.mode);
        const endResult = await handler.onGameEnd(game);

        if (!endResult || !endResult.verified) {
            return NextResponse.json({
                success: false,
                error: 'Verification failed',
            }, { status: 400 });
        }

        // Fetch updated session
        const updatedSession = await prisma.gameSession.findUnique({
            where: { gameId: params.gameId },
        });

        return NextResponse.json({
            success: true,
            gameSession: updatedSession,
        });
    } catch (error: any) {
        console.error('Verification error:', error);
        return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
    }
}
