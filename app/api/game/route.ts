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

            // Fire-and-forget: start SubID registration so it's ready when game ends
            // The registernamecommitment goes into mempool immediately,
            // registeridentity needs it mined (~60s), so starting early is key.
            (async () => {
                try {
                    const axios = require('axios');
                    const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
                    const parentAddress = process.env.CHESSGAME_IDENTITY_ADDRESS;

                    const commitRes = await axios.post(VERUS_RPC_URL, {
                        method: 'registernamecommitment',
                        params: [subIdName, parentAddress, '', parentAddress],
                        id: 1, jsonrpc: '2.0',
                    });
                    if (commitRes.data.error) {
                        console.log(`[SubID] Commitment for ${subIdName} failed (may already exist):`, commitRes.data.error.message);
                        return;
                    }
                    console.log(`[SubID] Commitment for ${subIdName} submitted:`, commitRes.data.result.txid);
                } catch (e: any) {
                    console.error(`[SubID] Early commitment for ${subIdName} failed:`, e.message);
                }
            })();
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