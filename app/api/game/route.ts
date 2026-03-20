import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initialPieces } from '@/app/lib/initialPieces';
import { io } from "socket.io-client";
import { popReadySubId, ensurePoolSize } from '@/app/utils/subid-pool';
import { nextGameNumber } from '@/app/utils/game-counter';
import { rpcCall } from '@/app/utils/verus-rpc';
import { isValidThemeId, isValidLogoMode } from '@/app/utils/board-themes';

/**
 * Fire-and-forget: submit a registernamecommitment so the SubID
 * starts mining early. Does not block the response.
 */
function startEarlyCommitment(subIdName: string) {
    const parentAddress = process.env.CHESSGAME_IDENTITY_ADDRESS;
    (async () => {
        try {
            const result = await rpcCall('registernamecommitment', [
                subIdName, parentAddress, '', parentAddress,
            ]);
            console.log(`[SubID] Commitment for ${subIdName} submitted:`, result.txid);
        } catch (e: any) {
            console.log(`[SubID] Early commitment for ${subIdName} failed:`, e.message);
        }
    })();
}

export async function POST(req: Request) {
    try {
        const { whitePlayerId, blackPlayerId, mode, boardTheme, logoMode } = await req.json();

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
        const validTheme = (boardTheme && isValidThemeId(boardTheme)) ? boardTheme : 'classic';
        const validLogoMode = (logoMode && isValidLogoMode(logoMode)) ? logoMode : 'off';

        const newGame = await prisma.game.create({
            data: {
                whitePlayerId,
                blackPlayerId,
                boardState: initialBoardState,
                status: 'IN_PROGRESS',
                mode: gameMode,
                boardTheme: validTheme,
                logoMode: validLogoMode,
            },
        });

        if (gameMode === 'normal') {
            // Normal mode: allocate SubID, fire-and-forget commitment
            const { subIdName } = await nextGameNumber();

            await prisma.gameSession.create({
                data: { gameId: newGame.id, subIdName },
            });

            startEarlyCommitment(subIdName);

        } else if (gameMode === 'showcase') {
            // Showcase mode: try pool first, fall back to on-the-fly
            const poolSubId = await popReadySubId();

            if (poolSubId) {
                await prisma.gameSession.create({
                    data: {
                        gameId: newGame.id,
                        subIdName: poolSubId.subIdName,
                        subIdAddress: poolSubId.address,
                    },
                });
                console.log(`[SubID Pool] Assigned ${poolSubId.subIdName} (${poolSubId.address}) to game ${newGame.id}`);

                await prisma.subIdPool.update({
                    where: { subIdName: poolSubId.subIdName },
                    data: { usedByGameId: newGame.id },
                });

                ensurePoolSize().catch(err => console.error('[SubID Pool] Replenish failed:', err.message));
            } else {
                console.log('[SubID Pool] No ready SubIDs, falling back to on-the-fly registration');
                const { subIdName } = await nextGameNumber();

                await prisma.gameSession.create({
                    data: { gameId: newGame.id, subIdName },
                });

                startEarlyCommitment(subIdName);
            }
        }

        const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://192.168.0.162:3001');

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
