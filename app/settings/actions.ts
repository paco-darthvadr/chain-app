'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

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

  // Handle optional avatar upload
  const avatarFile = formData.get('avatar') as File | null;
  let avatarUrl: string | null = null;

  try {
    if (avatarFile && (avatarFile as any).size > 0) {
      // Validate type (allow common image types)
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      const fileType = (avatarFile as any).type || '';
      if (!allowed.includes(fileType)) {
        return { success: false, error: 'Avatar must be a PNG, JPEG, WEBP or GIF image.' };
      }

      // Read file contents
      const arrayBuffer = await (avatarFile as any).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Ensure upload directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
      await fs.promises.mkdir(uploadsDir, { recursive: true });

      // Build filename
      const ext = fileType === 'image/png' ? 'png' : fileType === 'image/webp' ? 'webp' : fileType === 'image/gif' ? 'gif' : 'jpg';
      const fileName = `${userId}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);

      // Save file
      await fs.promises.writeFile(filePath, buffer);

      // Public URL
      avatarUrl = `/uploads/avatars/${fileName}`;
    }

    // If no uploaded avatar, fall back to generated initials avatar
    if (!avatarUrl) {
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        displayName
      )}&background=random&color=fff`;
    }

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