'use client';

import { useState } from 'react';
import { getLoginQr } from '../actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from 'next/image';

const Login = () => {
    const [userId, setUserId] = useState('');
    const [qrCode, setQrCode] = useState<{ tinyurl: string; pngname: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!userId) {
            setError('Please enter a user ID.');
            return;
        }
        setLoading(true);
        setError(null);
        setQrCode(null);

        const result = await getLoginQr(userId);

        if (result.error) {
            setError(result.error);
        } else if (result.success) {
            setQrCode(result.success);
        }
        setLoading(false);
    };
    
    return ( 
        <div className="flex flex-col items-center justify-center p-8">
            <h1 className="text-3xl font-bold mb-6">
                Login with Verus
            </h1>
            <div className="w-full max-w-sm space-y-4">
                <Input 
                    type="text"
                    placeholder="Enter your User ID (i-address)"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={loading}
                />
                <Button onClick={handleLogin} disabled={loading} className="w-full">
                    {loading ? 'Generating QR Code...' : 'Login with Verus'}
                </Button>
            </div>

            {error && <p className="text-red-500 mt-4">{error}</p>}

            {qrCode && (
                <div className="mt-8 flex flex-col items-center">
                    <p className="mb-2">Scan this QR code with your Verus mobile wallet</p>
                    <Image 
                        src={`/${qrCode.pngname}`} 
                        alt="Verus Login QR Code"
                        width={250}
                        height={250}
                    />
                    <p className="mt-4">
                        Or click this link: <a href={qrCode.tinyurl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{qrCode.tinyurl}</a>
                    </p>
                </div>
            )}
        </div>
     );
}
 
export default Login;