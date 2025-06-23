import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// This file handles all requests for /api/game and /api/game/[gameId]

// GET /api/game/[gameId] - Fetches a specific game
export async function GET(request: Request, { params }: { params: { gameId: string } }) {
    try {
        const game = await prisma.game.findUnique({
            where: {
                id: params.gameId,
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            },
        });
        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }
        return NextResponse.json(game);
    } catch (error) {
        console.error('Error fetching game:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/game/[gameId] - Updates a game (e.g., board state, status, winner)
export async function PATCH(request: Request, { params }: { params: { gameId: string } }) {
    try {
        const body = await request.json();
        const { boardState, status, winner } = body;

        const dataToUpdate: any = {};
        if (boardState) dataToUpdate.boardState = boardState;
        if (status) dataToUpdate.status = status;
        if (winner) dataToUpdate.winner = winner;

        if (Object.keys(dataToUpdate).length === 0) {
            return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
        }

        const updatedGame = await prisma.game.update({
            where: {
                id: params.gameId,
            },
            data: dataToUpdate,
            include: {
                whitePlayer: true,
                blackPlayer: true,
            }
        });
        return NextResponse.json(updatedGame);
    } catch (error) {
        console.error('Error updating game:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 