import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET(req: NextRequest, { params }: { params: { gameId: string } }) {
  const resolvedParams = await params;
  const { gameId } = resolvedParams;
  const { searchParams } = new URL(req.url);
  const move = searchParams.get('move');

  if (!move) {
    return NextResponse.json({ error: 'Move parameter is required' }, { status: 400 });
  }

  try {
    // Find the move in the database
    const dbMove = await prisma.move.findFirst({
      where: { 
        gameId, 
        move 
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!dbMove) {
      return NextResponse.json({ error: 'Move not found' }, { status: 404 });
    }

    const response = NextResponse.json({
      move: dbMove.move,
      blockchainTxId: dbMove.blockchainTxId,
      blockchainVdxfKey: dbMove.blockchainVdxfKey,
      blockchainStoredAt: dbMove.blockchainStoredAt,
    });
    
    // Prevent Next.js from recompiling the page on API calls
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('X-No-Compile', 'true');
    
    return response;

  } catch (error) {
    console.error('Error fetching move status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}