export const runtime = 'nodejs'
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        verusId: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    // For each user, count the number of games they've won
    const leaderboard = await Promise.all(
      users.map(async (user: { id: string; verusId: string; displayName: string | null; avatarUrl: string | null }) => {
        const winCount = await prisma.game.count({
          where: { 
            winner: user.id,
            status: 'COMPLETED',
          },
        });
        return { ...user, winCount };
      })
    );

    // Sort by winCount descending
    leaderboard.sort((a, b) => b.winCount - a.winCount);

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('[LEADERBOARD_API]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
} 