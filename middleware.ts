import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set in the environment');

// List of public routes (no auth required)
const PUBLIC_PATHS = [
  '/api/login/verify',
  '/api/login/cli',
  '/api/login-qr',
  '/api/login/logout',
  '/api/pool',
  '/login',
  '/login/complete',
  '/favicon.ico',
  '/_next',
  '/public',
  '/',
];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((publicPath) =>
    publicPath === '/' ? path === '/' : path.startsWith(publicPath)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Allow internal requests from server.js (rematch creates games)
  // Uses INTERNAL_API_SECRECT env var (note: legacy spelling)
  {
    const secret = process.env.INTERNAL_API_SECRECT;
    const isInternalGameRoute =
      (pathname === '/api/game' && request.method === 'POST') ||
      (pathname.match(/^\/api\/game\/[^/]+$/) && request.method === 'GET');
    if (isInternalGameRoute && (!secret || request.headers.get('x-internal-api-secret') === secret)) {
      return NextResponse.next();
    }
  }

  const token = request.cookies.get('token')?.value;
  if (!token) {
    // API route: return 401, Page: redirect to /login
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    } else {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch (err) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    } else {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }
}

export { proxy as middleware };

export const config = {
  matcher: ['/((?!_next|favicon.ico|public).*)'],
};