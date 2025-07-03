import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const games = await prisma.game.findMany();
  return NextResponse.json(games);
} 