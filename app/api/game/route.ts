import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { io } from "socket.io-client";
import { popReadySubId, ensurePoolSize } from '@/app/utils/subid-pool';
import { nextGameNumber } from '@/app/utils/game-counter';
import { rpcCall, waitForConfirmation, buildSubIdFullName } from '@/app/utils/verus-rpc';
import { isValidThemeId, isValidLogoMode } from '@/app/utils/board-themes';
import { getGameConfig, isValidGameType } from '@/app/games/registry';

/**
 * Background SubID registration: commit → wait for confirmation → register identity → update session.
 * Runs async in the background so the SubID is ready by the time the game ends.
 * Does NOT block the API response.
 */
function registerSubIdInBackground(gameId: string, subIdName: string, parentIdentityAddress?: string, parentIdentityName?: string) {
    const parentAddress = parentIdentityAddress || process.env.CHESSGAME_IDENTITY_ADDRESS;
    const fullName = buildSubIdFullName(subIdName, parentIdentityName);

    (async () => {
        try {
            // Step 1: Check if SubID already exists
            try {
                const existing = await rpcCall('getidentity', [fullName]);
                if (existing?.identity?.identityaddress) {
                    console.log(`[SubID] ${fullName} already exists at ${existing.identity.identityaddress}`);
                    await prisma.gameSession.update({
                        where: { gameId },
                        data: { subIdAddress: existing.identity.identityaddress },
                    });
                    return;
                }
            } catch { /* not found — proceed */ }

            // Step 2: registernamecommitment
            const commitment = await rpcCall('registernamecommitment', [
                subIdName, parentAddress, '', parentAddress,
            ]);
            console.log(`[SubID] Commitment for ${subIdName} submitted:`, commitment.txid);

            // Step 3: Wait for commitment confirmation
            const confirmed = await waitForConfirmation(commitment.txid, 900000);
            if (!confirmed) {
                console.error(`[SubID] Commitment for ${subIdName} not confirmed after 15 minutes`);
                return;
            }
            console.log(`[SubID] Commitment for ${subIdName} confirmed`);

            // Step 4: registeridentity
            const parentIdentity = await rpcCall('getidentity', [parentAddress]);
            const parentPrimaryAddress = parentIdentity.identity.primaryaddresses[0];

            await rpcCall('registeridentity', [{
                txid: commitment.txid,
                namereservation: commitment.namereservation,
                identity: {
                    name: subIdName,
                    parent: parentAddress,
                    primaryaddresses: [parentPrimaryAddress],
                    minimumsignatures: 1,
                },
            }]);
            console.log(`[SubID] registeridentity sent for ${subIdName}`);

            // Step 5: Poll for identity to appear on chain
            for (let attempt = 0; attempt < 90; attempt++) {
                try {
                    const registered = await rpcCall('getidentity', [fullName]);
                    if (registered?.identity?.identityaddress) {
                        await prisma.gameSession.update({
                            where: { gameId },
                            data: { subIdAddress: registered.identity.identityaddress },
                        });
                        console.log(`[SubID] ${subIdName} registered at ${registered.identity.identityaddress}`);
                        return;
                    }
                } catch { /* not found yet */ }
                await new Promise(r => setTimeout(r, 10000));
            }

            console.error(`[SubID] ${subIdName} registered but not visible after 15 minutes`);
        } catch (e: any) {
            console.error(`[SubID] Background registration failed for ${subIdName}:`, e.message);
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

                registerSubIdInBackground(newGame.id, subIdName, config.parentIdentityAddress, config.parentIdentityName);

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

                    ensurePoolSize(5, validGameType, config.parentIdentityAddress, config.parentIdentityName).catch(err => console.error('[SubID Pool] Replenish failed:', err.message));
                } else {
                    console.log('[SubID Pool] No ready SubIDs, falling back to on-the-fly registration');
                    const { subIdName } = await nextGameNumber(validGameType, config.subIdPrefix + '-');

                    await prisma.gameSession.create({
                        data: { gameId: newGame.id, subIdName },
                    });

                    registerSubIdInBackground(newGame.id, subIdName, config.parentIdentityAddress, config.parentIdentityName);
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
