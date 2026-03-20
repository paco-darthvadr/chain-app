import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { io } from "socket.io-client";
import { popReadySubId, ensurePoolSize } from '@/app/utils/subid-pool';
import { nextGameNumber } from '@/app/utils/game-counter';
import { rpcCall } from '@/app/utils/verus-rpc';
import { isValidThemeId, isValidLogoMode } from '@/app/utils/board-themes';
import { getGameConfig, isValidGameType } from '@/app/games/registry';

/**
 * Fire-and-forget: submit a registernamecommitment so the SubID
 * starts mining early. Does not block the response.
 */
function startEarlyCommitment(subIdName: string, parentIdentityAddress?: string) {
    const parentAddress = parentIdentityAddress || process.env.CHESSGAME_IDENTITY_ADDRESS;
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
        const { player1Id, player2Id, mode, boardTheme, logoMode, gameType } = await req.json();

        if (!player1Id || !player2Id) {
            return new NextResponse('Missing player IDs', { status: 400 });
        }

        const validGameType = (gameType && isValidGameType(gameType)) ? gameType : 'chess';
        const config = getGameConfig(validGameType);

        const initialBoardState = config.createInitialState() as any;

        const gameMode = mode || 'normal';
        const validTheme = (boardTheme && isValidThemeId(boardTheme)) ? boardTheme : 'classic';
        const validLogoMode = (logoMode && isValidLogoMode(logoMode)) ? logoMode : 'off';

        const newGame = await prisma.game.create({
            data: {
                player1Id,
                player2Id,
                boardState: initialBoardState,
                status: 'IN_PROGRESS',
                mode: gameMode,
                boardTheme: validTheme,
                logoMode: validLogoMode,
                gameType: validGameType,
            },
        });

        if (config.chainEnabled) {
            if (gameMode === 'normal') {
                // Normal mode: allocate SubID, fire-and-forget commitment
                const { subIdName } = await nextGameNumber(validGameType, config.subIdPrefix + '-');

                await prisma.gameSession.create({
                    data: { gameId: newGame.id, subIdName },
                });

                startEarlyCommitment(subIdName, config.parentIdentityAddress);

            } else if (gameMode === 'showcase') {
                // Showcase mode: try pool first, fall back to on-the-fly
                const poolSubId = await popReadySubId(validGameType);

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

                    ensurePoolSize(5, validGameType, config.parentIdentityAddress).catch(err => console.error('[SubID Pool] Replenish failed:', err.message));
                } else {
                    console.log('[SubID Pool] No ready SubIDs, falling back to on-the-fly registration');
                    const { subIdName } = await nextGameNumber(validGameType, config.subIdPrefix + '-');

                    await prisma.gameSession.create({
                        data: { gameId: newGame.id, subIdName },
                    });

                    startEarlyCommitment(subIdName, config.parentIdentityAddress);
                }
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
