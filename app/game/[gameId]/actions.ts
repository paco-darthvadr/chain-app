'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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

export async function updateGame(gameId: string, boardState: any) {
    try {
        const game = await prisma.game.update({
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
        return game;
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