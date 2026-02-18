import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const { move, player, prevHash, boardState } = await req.json();
    const gameId = params.gameId;
    // Store the move in the DB
    const moveNum = await prisma.move.count({ where: { gameId } }) + 1;
    const timestamp = Math.floor(Date.now() / 1000);
    const dbMove = await prisma.move.create({
      data: {
        gameId,
        move,
        createdAt: new Date(timestamp * 1000),
      },
    });
    // Update the Game's boardState
    await prisma.game.update({
      where: { id: gameId },
      data: { boardState },
    });
    return NextResponse.json({ success: true, dbMove });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
} 