import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import axios from 'axios';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set in the environment');
const JWT_EXPIRES_IN = '24h';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

async function rpcCall(method: string, params: any[] = []): Promise<any> {
    const response = await axios.post(VERUS_RPC_URL, {
        method,
        params,
        id: 1,
        jsonrpc: '2.0',
    });
    if (response.data.error) {
        throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
    }
    return response.data.result;
}

// In-memory challenge store (simple for dev — challenges expire after 5 min)
const pendingChallenges = new Map<string, { challenge: string; createdAt: number }>();

// GET — generate a challenge to sign
export async function GET() {
    const challenge = randomBytes(32).toString('hex');
    const challengeId = randomBytes(16).toString('hex');

    pendingChallenges.set(challengeId, {
        challenge,
        createdAt: Date.now(),
    });

    // Clean up old challenges (> 5 min)
    const now = Date.now();
    pendingChallenges.forEach((data, id) => {
        if (now - data.createdAt > 5 * 60 * 1000) {
            pendingChallenges.delete(id);
        }
    });

    return NextResponse.json({ challengeId, challenge });
}

// POST — verify signature and login
export async function POST(request: Request) {
    try {
        const { challengeId, verusId, signature } = await request.json();

        if (!challengeId || !verusId || !signature) {
            return NextResponse.json({ error: 'Missing challengeId, verusId, or signature' }, { status: 400 });
        }

        // Check challenge exists and isn't expired
        const pending = pendingChallenges.get(challengeId);
        if (!pending) {
            return NextResponse.json({ error: 'Challenge not found or expired' }, { status: 400 });
        }
        if (Date.now() - pending.createdAt > 5 * 60 * 1000) {
            pendingChallenges.delete(challengeId);
            return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
        }

        // Verify the signature via Verus daemon
        const isValid = await rpcCall('verifymessage', [verusId, signature, pending.challenge]);

        if (!isValid) {
            return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
        }

        // Signature is valid — clean up challenge
        pendingChallenges.delete(challengeId);

        // Get identity info for display name
        let displayName = null;
        try {
            const identity = await rpcCall('getidentity', [verusId]);
            if (identity?.identity?.name) {
                displayName = identity.identity.name;
            }
        } catch (e) {
            // Non-fatal — proceed without display name
        }

        // Resolve the i-address for the verusId (could be a name like "alice@")
        let verusIdKey = verusId;
        try {
            const identity = await rpcCall('getidentity', [verusId]);
            if (identity?.identity?.identityaddress) {
                verusIdKey = identity.identity.identityaddress;
            }
        } catch (e) {
            // Use the provided verusId as-is
        }

        // Upsert user in database
        const user = await prisma.user.upsert({
            where: { verusId: verusIdKey },
            update: { displayName },
            create: { verusId: verusIdKey, displayName },
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, verusId: user.verusId },
            JWT_SECRET as string,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set cookie and return user
        const response = NextResponse.json({
            success: true,
            user: { id: user.id, verusId: user.verusId, displayName: user.displayName },
        });
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 24 hours
        });

        return response;
    } catch (error: any) {
        console.error('CLI login error:', error);
        return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
    }
}
