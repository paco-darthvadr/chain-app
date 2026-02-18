import { NextResponse } from 'next/server';
import jwt  from 'jsonwebtoken';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}
const JWT_EXPIRES_IN = '24h'; // Token expiration time

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const verusId = searchParams.get('verusId');
  if (!userId || !verusId) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }
  // Generate JWT token
  const token = jwt.sign(
    { userId, verusId },
    JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN }
  );
  // Set cookie and redirect to dashboard
  const response = NextResponse.redirect(`${APP_URL}/dashboard?userId=${encodeURIComponent(userId)}`);
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day in seconds
  });
  return response;
}