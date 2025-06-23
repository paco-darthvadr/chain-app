import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { verusId } = await req.json();

    if (!verusId) {
      return new NextResponse('Missing verusId', { status: 400 });
    }

    let user = await prisma.user.findUnique({
      where: { verusId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          verusId,
        },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('[USER_API]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
} 