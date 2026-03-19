import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import axios from 'axios';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

async function rpcCall(method: string, params: any[] = []): Promise<any> {
    const response = await axios.post(VERUS_RPC_URL, {
        method, params, id: 1, jsonrpc: '2.0',
    });
    if (response.data.error) throw new Error(response.data.error.message);
    return response.data.result;
}

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

        const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
        const fullName = `${session.subIdName}.${parentName.replace('@', '')}@`;

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
