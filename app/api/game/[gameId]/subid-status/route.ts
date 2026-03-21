import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { rpcCall, buildSubIdFullName } from '@/app/utils/verus-rpc';
import { getGameConfig } from '@/app/games/registry';

// GET /api/game/[gameId]/subid-status — Check SubID registration progress
export async function GET(request: Request, { params }: { params: { gameId: string } }) {
    try {
        const session = await prisma.gameSession.findUnique({
            where: { gameId: params.gameId },
        });

        if (!session) {
            return NextResponse.json({ status: 'none', message: 'No game session' });
        }

        if (!session.subIdName) {
            return NextResponse.json({ status: 'none', message: 'No SubID assigned' });
        }

        // Get game to determine game type for correct parent identity
        const game = await prisma.game.findUnique({ where: { id: params.gameId }, select: { gameType: true } });
        const config = getGameConfig(game?.gameType || 'chess');
        const fullName = buildSubIdFullName(session.subIdName, config.parentIdentityName);

        // If we already have the address stored, it's online
        if (session.subIdAddress) {
            return NextResponse.json({
                status: 'online',
                subIdName: session.subIdName,
                fullName,
                address: session.subIdAddress,
            });
        }

        // Check if the identity exists on chain
        try {
            const identity = await rpcCall('getidentity', [fullName]);
            if (identity?.identity?.identityaddress) {
                // Update session with the address
                await prisma.gameSession.update({
                    where: { gameId: params.gameId },
                    data: { subIdAddress: identity.identity.identityaddress },
                });
                return NextResponse.json({
                    status: 'online',
                    subIdName: session.subIdName,
                    fullName,
                    address: identity.identity.identityaddress,
                });
            }
        } catch (e) {
            // Identity not found yet
        }

        // Not online yet — check if commitment is in mempool or confirmed
        return NextResponse.json({
            status: 'pending',
            subIdName: session.subIdName,
            fullName,
            message: 'SubID commitment submitted, waiting for registration...',
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message || 'Failed to check SubID status',
        });
    }
}
