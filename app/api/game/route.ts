import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initialPieces } from '@/app/lib/initialPieces';
import { io } from "socket.io-client";

export async function POST(req: Request) {
    try {
        const { whitePlayerId, blackPlayerId, mode } = await req.json();

        if (!whitePlayerId || !blackPlayerId) {
            return new NextResponse('Missing player IDs', { status: 400 });
        }

        const initialBoardState = {
            pieces: initialPieces,
            totalTurns: 0,
            currentTeam: 'w',
            winningTeam: null,
            capturedPieces: [],
        };

        const gameMode = mode || 'normal';

        const newGame = await prisma.game.create({
            data: {
                whitePlayerId,
                blackPlayerId,
                boardState: initialBoardState,
                status: 'IN_PROGRESS',
                mode: gameMode,
            },
        });

        // For Normal mode, create a GameSession with SubID name
        if (gameMode === 'normal') {
            // Atomic counter increment for SubID naming (safe for SQLite)
            await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES ('singleton', 1)`;
            const gameNumber = await prisma.$transaction(async (tx) => {
                await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = 'singleton'`;
                const result = await tx.gameCounter.findUnique({ where: { id: 'singleton' } });
                return result!.nextGame - 1; // Pre-increment value
            });
            const subIdName = `game${String(gameNumber).padStart(4, '0')}`;

            await prisma.gameSession.create({
                data: {
                    gameId: newGame.id,
                    subIdName,
                },
            });
        }

        const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://192.168.0.162:3001');
        
        // It's good practice to disconnect after emitting the event
        // to avoid leaving dangling connections from the serverless function.
        socket.on('connect', () => {
            console.log("Socket connected to emit new-game-created");
            socket.emit('new-game-created');
            socket.disconnect();
            console.log("Socket disconnected after emitting");
        });

        return NextResponse.json(newGame);

    } catch (error) {
        console.error('[GAME_API_CREATE]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
} 