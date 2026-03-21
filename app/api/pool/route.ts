import { NextResponse } from 'next/server';
import { getPoolStatus, ensurePoolSize, isPoolEnabled } from '@/app/utils/subid-pool';
import { getAllGameTypes } from '@/app/games/registry';

// GET /api/pool — returns pool status
export async function GET() {
  try {
    const enabled = isPoolEnabled();
    const status = await getPoolStatus();
    return NextResponse.json({ enabled, ...status, total: status.ready + status.registering + status.failed + status.used });
  } catch (error: any) {
    console.error('[Pool API] Status error:', error.message);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// POST /api/pool — triggers replenishment for ALL chain-enabled game types
export async function POST(req: Request) {
  try {
    const secret = process.env.INTERNAL_API_SECRET;
    if (secret) {
      const authHeader = req.headers.get('x-api-secret');
      if (authHeader !== secret) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    if (!isPoolEnabled()) {
      return NextResponse.json({ message: 'Pool is disabled' }, { status: 200 });
    }

    // Replenish pool for every chain-enabled game type
    const gameTypes = getAllGameTypes().filter(g => g.chainEnabled);
    for (const config of gameTypes) {
      console.log(`[Pool API] Replenishing pool for ${config.type}...`);
      await ensurePoolSize(5, config.type, config.parentIdentityAddress, config.parentIdentityName);
    }

    const status = await getPoolStatus();
    return NextResponse.json({ message: 'Replenishment triggered', ...status });
  } catch (error: any) {
    console.error('[Pool API] Replenish error:', error.message);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
