'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getUserSettings(userId: string) {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user;
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return null;
  }
}

export async function updateUserSettings(
  userId: string,
  formData: FormData
) {
  if (!userId) {
    return { success: false, error: 'User not found' };
  }

  const displayName = formData.get('displayName') as string;

  if (!displayName || displayName.trim().length < 3) {
    return { success: false, error: 'Display name must be at least 3 characters long.' };
  }

  try {
    // Generate a simple avatar URL from the initials
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=random&color=fff`;

    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName.trim(),
        avatarUrl,
      },
    });

    // Revalidate paths to show the new name everywhere
    revalidatePath('/users');
    revalidatePath('/chat');
    revalidatePath('/settings');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating user settings:', error);
    return { success: false, error: 'Failed to update settings.' };
  }
} 