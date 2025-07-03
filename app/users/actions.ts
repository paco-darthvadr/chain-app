'use server';

import { prisma } from '@/lib/prisma';

export async function getUsers() {
    try {
        const users = await prisma.user.findMany();
        return users;
    } catch (error) {
        console.error('Failed to get users:', error);
        return [];
    }
}

export async function getCurrentUser() {
    try {
        // Using testuser1 as the logged-in user for now
        const user = await prisma.user.findUnique({ where: { verusId: 'testuser1' } });
        return user;
    } catch (error) {
        console.error('Failed to get current user:', error);
        return null;
    }
}

export async function getGamesForUser(userId: string) {
    if (!userId) return [];
    try {
        const games = await prisma.game.findMany({
            where: {
                OR: [
                    { whitePlayerId: userId },
                    { blackPlayerId: userId },
                ],
                status: 'COMPLETED', // Only show active games
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            },
            orderBy: {
                updatedAt: 'desc',
            }
        });
        return games;
    } catch (error) {
        console.error('Failed to get games for user:', error);
        return [];
    }
}

export async function deleteUser(userId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            // Delete all games where the user is either the white or black player
            await tx.game.deleteMany({
                where: {
                    OR: [
                        { whitePlayerId: userId },
                        { blackPlayerId: userId },
                    ],
                },
            });

            // Delete the user
            await tx.user.delete({
                where: {
                    id: userId,
                },
            });
        });
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: 'Failed to delete user.' };
    }
} 