import { NextResponse } from 'next/server';
import { image } from 'qr-image';
import { getverified } from '@/app/utils/deeplink.js';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Generate deeplink and shortUrl (no userId needed)
    const result = await getverified();
    if (!result || !result.deeplink) {
      return NextResponse.json({ error: 'Could not generate deeplink.' }, { status: 500 });
    }
    const { deeplink, challenge_id } = result;

    // Always generate QR code from the actual deeplink
    const qr_png = image(deeplink, { type: 'png' });
    const pngname = `login_qr_${Date.now()}.png`;
    const filePath = path.join(process.cwd(), 'public', pngname);
    const stream = qr_png.pipe(fs.createWriteStream(filePath));
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // Return both the deeplink and the shortUrl for frontend use
    return NextResponse.json({  deeplink, pngname, challengeId: challenge_id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate QR code.' }, { status: 500 });
  }
} 