'use server';

import { image } from 'qr-image';
import { createWriteStream } from 'node:fs';
import { checkUserExists } from "./utils/database.js";
import { getverified, shortenUrl } from "./utils/deeplink.js";

// Helper function to introduce a delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getLoginQr = async (userId: string) => {
    try {
        if (await checkUserExists(userId)) {
            return { error: "You have already verified." };
        }
    
        const result = await getverified();

        if (!result?.deeplink) {
            return { error: "Could not generate deeplink." };
        }

        const deeplinkurl = result.deeplink;
        const tinyurl = await shortenUrl(deeplinkurl);

        const qr_png = image(deeplinkurl, { type: 'png' });
        const pngname = `${userId}_qr_code.png`;
    
        const stream = qr_png.pipe(createWriteStream(`./public/${pngname}`));
        
        await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        // It seems the original code had a 'wait'. This might be to ensure
        // the file is available before the client tries to access it.
        await wait(2000);

        const userqr = { tinyurl, pngname };

        // Call the user API endpoint to create/find the user
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ verusId: userId }),
            });

            if (!res.ok) {
                throw new Error('Failed to create or find user');
            }

            const user = await res.json();
            console.log('User processed:', user);
            
        } catch (apiError) {
            console.error('[USER_API_CALL_ERROR]', apiError);
            return { error: 'Failed to process user after login.' };
        }

        return { success: userqr };

    } catch (error) {
        console.error(error);
        return { error: 'Failed to generate QR code.' };
    }
} 