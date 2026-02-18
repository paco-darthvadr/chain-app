import { NextRequest, NextResponse } from 'next/server';
import { getProcessedChallenges } from '@/app/utils/database.js';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set in the environment');
const JWT_EXPIRES_IN = '24h';

export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get('challengeId');
  if (!challengeId) {
    return NextResponse.redirect('/login');
  }
  // Check if challenge is processed
  const challenge = await getProcessedChallenges(challengeId);
  if (!challenge || typeof challenge !== 'object' || !('decision' in challenge)) {
    return NextResponse.redirect('/login');
  }
  const signingId = (challenge as any).decision?.signing_id;
  if (!signingId) {
    return NextResponse.redirect('/login');
  }
  // Find user in DB
  const user = await prisma.user.findUnique({ where: { verusId: signingId } });
  if (!user) {
    return NextResponse.redirect('/login');
  }
  // Generate JWT
  const token = jwt.sign(
    {
      userId: user.id,
      verusId: user.verusId,
    },
    JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN }
  );
  // Set cookie and redirect
  const response = NextResponse.redirect('/dashboard');
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return response;
} 