import { NextResponse } from 'next/server';
import { verusLogin, getIdentity } from '@/app/utils/verusLogin.js';
import { getProcessedChallenges, setProcessedChallenges } from '@/app/utils/database.js';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set in the environment');
const JWT_EXPIRES_IN = '24h'; // 24 hour expiry

// Helper to check if value is a plain object
function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // Extract the challenge ID from the redirect URI in the response
    const redirectUri = data?.decision?.request?.challenge?.redirect_uris?.[0]?.uri;
    if (!redirectUri) {
      return NextResponse.json({ error: 'Invalid response: missing redirect URI' }, { status: 400 });
    }
    // Extract challenge ID from the redirect URI (e.g., "https://domain/login?id=challengeId")
    const urlParams = new URL(redirectUri).searchParams;
    const challengeId = urlParams.get('id');
    if (!challengeId) {
      return NextResponse.json({ error: 'Invalid response: missing challenge ID' }, { status: 400 });
    }
    console.log('Processing login response for challenge:', challengeId);
    // Check if this challenge has already been processed
    const existingChallenge = await getProcessedChallenges(challengeId);
    if (existingChallenge) {
      return NextResponse.json({ error: 'Challenge already processed' }, { status: 400 });
    }
    // Verify the login response using the verusLogin function (pass challengeId as session key)
    const result = await verusLogin(data, challengeId);
    if (result.success) {
      // Optionally, you can store the challenge as processed here
      setProcessedChallenges(challengeId, data);
      // Get identity info using signingId
      let displayName = null;
      let avatarUrl = null;
      let user = null;
      if (result.signingId) {
        const identity = await getIdentity(result.signingId);
        console.log('Identity:', identity);
        if (identity && identity.identity && identity.identity.name) {
          displayName = identity.identity.name;
        }
        // Upsert user in the database
        user = await prisma.user.upsert({
          where: { verusId: result.signingId },
          update: { displayName },
          create: { verusId: result.signingId, displayName },
        });
      }
      // --- JWT Generation ---
      const token = jwt.sign(
        {
          userId: user?.id,
          verusId: user?.verusId,
        },
        JWT_SECRET as string,
        { expiresIn: JWT_EXPIRES_IN }
      );
      // Set JWT as HTTP-only, Secure cookie
      const response = NextResponse.json({
        success: true,
        message: 'Login verified successfully',
        challengeId: challengeId,
        signingId: result.signingId,
        user,
      });
      response.cookies.set('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60, // 1 hour
      });
      return response;
    } else {
      return NextResponse.json({
        error: result.error || 'Login verification failed'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Login verification error:', error);
    return NextResponse.json({
      error: 'Internal server error during login verification'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Polling endpoint: /api/login/verify?challengeId=...
  const { searchParams } = new URL(request.url);
  const challengeId = searchParams.get('challengeId');
  if (!challengeId) {
    return NextResponse.json({ success: false, error: 'Missing challengeId' }, { status: 400 });
  }
  const existingChallenge = await getProcessedChallenges(challengeId);
  if (existingChallenge) {
    let challengeData: any = existingChallenge;
    if (typeof challengeData === 'string') {
      try {
        challengeData = JSON.parse(challengeData);
      } catch (e) {
        challengeData = {};
      }
    }
    let signingId: string | undefined = undefined;
    if (isObject(challengeData) && typeof challengeData.signing_id === 'string') {
      signingId = challengeData.signing_id;
    } else if (
      isObject(challengeData) &&
      isObject(challengeData.decision) &&
      typeof challengeData.decision.signing_id === 'string'
    ) {
      signingId = challengeData.decision.signing_id;
    }
    if (signingId) {
      const user = await prisma.user.findUnique({ where: { verusId: signingId } });
      if (user) {
        return NextResponse.json({ success: true, user: { id: user.id, verusId: user.verusId } });
      }
    }
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ success: false });
  }
} 