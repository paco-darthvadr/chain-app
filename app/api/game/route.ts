import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initialPieces } from '@/app/lib/initialPieces';
import { io } from "socket.io-client";

export async function POST(req: Request) {
    try {
        const { whitePlayerId, blackPlayerId } = await req.json();

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

        const newGame = await prisma.game.create({
            data: {
                whitePlayerId,
                blackPlayerId,
                boardState: initialBoardState,
                status: 'IN_PROGRESS',
            },
        });

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