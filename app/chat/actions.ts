'use server';

import { prisma } from '@/lib/prisma';

export async function getUsersByIds(userIds: string[]) {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        displayName: true,
        verusId: true,
        avatarUrl: true,
      },
    });
    return users;
  } catch (error) {
    console.error('Error fetching users by IDs:', error);
    return [];
  }
} 