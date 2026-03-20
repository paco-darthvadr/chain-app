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

// POST /api/pool — triggers replenishment
export async function POST() {
  try {
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
