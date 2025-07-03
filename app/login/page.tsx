'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const Login = () => {
  const [qrCode, setQrCode] = useState<{ shortUrl: string; deeplink: string; pngname: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loginVerified, setLoginVerified] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchQr = async () => {
      setLoading(true);
      setError(null);
      setQrCode(null);
      try {
        const res = await fetch('/api/login-qr');
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setQrCode(data);
          setChallengeId(data.challengeId);
        }
      } catch (err) {
        setError('Failed to fetch QR code.');
      }
      setLoading(false);
    };
    fetchQr();
  }, []);

  useEffect(() => {
    if (!challengeId) return;
    setProcessing(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/login/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId })
        });
        const result = await res.json();
        if (result.success) {
          clearInterval(interval);
          setProcessing(false);
          setLoginVerified(true);
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      } catch (e) {
        // Optionally handle error
      }
    }, 5000); // 5 seconds interval for slow connections

    return () => {
      clearInterval(interval);
      setProcessing(false);
    };
  }, [challengeId, router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Login with Verus
        </h1>
        {loading && <p className="text-blue-500 mb-4">Generating QR Code...</p>}
        {!loginVerified && !loading && (
          <p className="text-blue-500 mb-4">Scan this QR code to login</p>
        )}
        {loginVerified && !loading && (
          <p className="text-blue-500 mb-4">Processing login... Please wait.</p>
        )}
        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        {qrCode && (
          <div className="mt-8 flex flex-col items-center">
            <p className="mb-2 text-center">Scan this QR code with your Verus mobile wallet</p>
            <Image
              src={`/${qrCode.pngname}`}
              alt="Verus Login QR Code"
              width={250}
              height={250}
            />
            <p className="mt-4 text-center">
              Or click this link: <a href={qrCode.deeplink} className="text-blue-500 hover:underline">{qrCode.deeplink}</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;