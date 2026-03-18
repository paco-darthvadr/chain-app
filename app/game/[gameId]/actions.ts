'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getModeHandler } from '@/app/utils/modes/mode-resolver';

/**
 * Convert frontend move format to UCI notation.
 * Input: "e2e4" (string) or { from: "e2", to: "e4", promotion?: "q" }
 * Output: "e2e4" or "e7e8q"
 */
function toUCI(move: any): string {
    if (typeof move === 'string') return move;
    if (move.from && move.to) {
        const base = `${move.from}${move.to}`;
        return move.promotion ? `${base}${move.promotion}` : base;
    }
    return String(move);
}

export async function getGame(gameId: string) {
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            },
        });
        return game;
    } catch (error) {
        console.error('Error fetching game:', error);
        return null;
    }
}

export async function updateGame(gameId: string, boardState: any, moveInfo?: { move: any; player: string }) {
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { whitePlayer: true, blackPlayer: true },
        });
        if (!game) return null;

        // Mode handler integration for move signing
        let signedPackage = null;
        if (moveInfo) {
            const handler = getModeHandler((game as any).mode);
            const uciMove = toUCI(moveInfo.move);

            signedPackage = await handler.onMove(game, {
                move: uciMove,
                player: moveInfo.player,
                boardState,
            });

            // Store the move in the Move table (with signed package if available)
            await prisma.move.create({
                data: {
                    gameId,
                    move: uciMove,
                    ...(signedPackage ? {
                        movePackage: {
                            subIdName: signedPackage.subIdName,
                            player: signedPackage.player,
                            moveNum: signedPackage.moveNum,
                            move: signedPackage.move,
                            prevHash: signedPackage.prevHash,
                        },
                        signature: signedPackage.signature,
                    } : {}),
                },
            });
        }

        // Update boardState (existing behavior)
        const updatedGame = await prisma.game.update({
            where: { id: gameId },
            data: {
                boardState,
                updatedAt: new Date()
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            },
        });
        revalidatePath(`/game/${gameId}`);

        // Return signed package alongside game for socket emission
        return { ...updatedGame, signedPackage };
    } catch (error) {
        console.error('Error updating game:', error);
        return null;
    }
}

export async function endGame(gameId: string, winningTeam: 'OUR' | 'OPPONENT' | 'DRAW') {
    try {
        // Fetch the game to get player IDs
        const existingGame = await prisma.game.findUnique({
            where: { id: gameId },
            include: { whitePlayer: true, blackPlayer: true },
        });

        let winnerId: string | null = null;
        if (winningTeam === 'OUR') {
            winnerId = existingGame?.whitePlayerId ?? null;
        } else if (winningTeam === 'OPPONENT') {
            winnerId = existingGame?.blackPlayerId ?? null;
        } // DRAW => winnerId stays null

        const game = await prisma.game.update({
            where: { id: gameId },
            data: { 
                status: 'COMPLETED',
                winner: winnerId,
                updatedAt: new Date()
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            },
        });
        revalidatePath(`/game/${gameId}`);
        return game;
    } catch (error) {
        console.error('Error ending game:', error);
        return null;
    }
}  