import { NextResponse } from 'next/server';
import { getPoolStatus, ensurePoolSize, isPoolEnabled } from '@/app/utils/subid-pool';

// GET /api/pool — returns pool status
export async function GET() {
  try {
    const enabled = isPoolEnabled();
    const status = await getPoolStatus();
    return NextResponse.json({ enabled, ...status, total: status.ready + status.registering + status.used });
  } catch (error: any) {
    console.error('[Pool API] Status error:', error.message);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// POST /api/pool — triggers replenishment (requires internal API secret)
export async function POST(req: Request) {
  try {
    // Auth: require internal secret to prevent unauthorized SubID registration
    const secret = process.env.INTERNAL_API_SECRECT;
    if (secret) {
      const authHeader = req.headers.get('x-api-secret');
      if (authHeader !== secret) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    if (!isPoolEnabled()) {
      return NextResponse.json({ message: 'Pool is disabled' }, { status: 200 });
    }
    await ensurePoolSize();
    const status = await getPoolStatus();
    return NextResponse.json({ message: 'Replenishment triggered', ...status });
  } catch (error: any) {
    console.error('[Pool API] Replenish error:', error.message);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
