'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const Login = () => {
  const [loginMode, setLoginMode] = useState<'cli' | 'qr'>('cli');
  const router = useRouter();

  // --- QR Mode State ---
  const [qrCode, setQrCode] = useState<{ shortUrl: string; deeplink: string; pngname: string } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loginVerified, setLoginVerified] = useState(false);

  // --- CLI Mode State ---
  const [cliChallenge, setCliChallenge] = useState<{ challengeId: string; challenge: string } | null>(null);
  const [cliLoading, setCliLoading] = useState(false);
  const [cliError, setCliError] = useState<string | null>(null);
  const [verusId, setVerusId] = useState('');
  const [signature, setSignature] = useState('');
  const [cliSubmitting, setCliSubmitting] = useState(false);

  // Fetch CLI challenge on mount
  useEffect(() => {
    if (loginMode === 'cli' && !cliChallenge) {
      fetchCliChallenge();
    }
  }, [loginMode]);

  const fetchCliChallenge = async () => {
    setCliLoading(true);
    setCliError(null);
    try {
      const res = await fetch('/api/login/cli');
      const data = await res.json();
      if (data.error) {
        setCliError(data.error);
      } else {
        setCliChallenge(data);
      }
    } catch (err) {
      setCliError('Failed to generate challenge.');
    }
    setCliLoading(false);
  };

  const handleCliLogin = async () => {
    if (!cliChallenge || !verusId.trim() || !signature.trim()) return;
    setCliSubmitting(true);
    setCliError(null);
    try {
      const res = await fetch('/api/login/cli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: cliChallenge.challengeId,
          verusId: verusId.trim(),
          signature: signature.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('currentUser', data.user.id);
        router.push('/dashboard');
      } else {
        setCliError(data.error || 'Login failed');
      }
    } catch (err) {
      setCliError('Network error during login.');
    }
    setCliSubmitting(false);
  };

  // --- QR Mode Logic ---
  useEffect(() => {
    if (loginMode !== 'qr') return;
    setQrLoading(true);
    setQrError(null);
    setQrCode(null);
    const fetchQr = async () => {
      try {
        const res = await fetch('/api/login-qr');
        const data = await res.json();
        if (data.error) {
          setQrError(data.error);
        } else {
          setQrCode(data);
          setChallengeId(data.challengeId);
        }
      } catch (err) {
        setQrError('Failed to fetch QR code.');
      }
      setQrLoading(false);
    };
    fetchQr();
  }, [loginMode]);

  useEffect(() => {
    if (!challengeId || loginMode !== 'qr') return;
    setProcessing(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/login/verify?challengeId=${challengeId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.user) {
            clearInterval(interval);
            setProcessing(false);
            setLoginVerified(true);
            localStorage.setItem('currentUser', result.user.id);
            router.push('/dashboard');
            return;
          }
        }
      } catch (e) {
        // Polling — ignore errors
      }
    }, 5000);
    return () => {
      clearInterval(interval);
      setProcessing(false);
    };
  }, [challengeId, loginMode, router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center p-8 max-w-lg w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Login with Verus
        </h1>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setLoginMode('cli')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              loginMode === 'cli'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            CLI Sign
          </button>
          <button
            onClick={() => setLoginMode('qr')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              loginMode === 'qr'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            QR Code (Mobile)
          </button>
        </div>

        {/* CLI Mode */}
        {loginMode === 'cli' && (
          <div className="w-full space-y-4">
            {cliLoading && <p className="text-blue-500">Generating challenge...</p>}
            {cliError && <p className="text-red-500">{cliError}</p>}

            {cliChallenge && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Run this command in your terminal to sign the challenge:
                  </p>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs break-all select-all">
                    verus -chain=VRSCTEST signmessage &quot;YOUR_ID@&quot; &quot;{cliChallenge.challenge}&quot;
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Your VerusID</label>
                  <input
                    type="text"
                    placeholder="e.g. alice@ or iABC123..."
                    value={verusId}
                    onChange={(e) => setVerusId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Signature</label>
                  <textarea
                    placeholder="Paste the signature output here"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm font-mono"
                  />
                </div>

                <button
                  onClick={handleCliLogin}
                  disabled={cliSubmitting || !verusId.trim() || !signature.trim()}
                  className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
                >
                  {cliSubmitting ? 'Verifying...' : 'Login'}
                </button>

                <button
                  onClick={() => { setCliChallenge(null); fetchCliChallenge(); }}
                  className="w-full px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground"
                >
                  Generate new challenge
                </button>
              </>
            )}
          </div>
        )}

        {/* QR Mode */}
        {loginMode === 'qr' && (
          <div className="flex flex-col items-center">
            {qrLoading && <p className="text-blue-500 mb-4">Generating QR Code...</p>}
            {!loginVerified && !qrLoading && (
              <p className="text-blue-500 mb-4">Scan this QR code to login</p>
            )}
            {loginVerified && !qrLoading && (
              <p className="text-blue-500 mb-4">Processing login... Please wait.</p>
            )}
            {qrError && <p className="text-red-500 mt-4 text-center">{qrError}</p>}
            {qrCode && (
              <div className="mt-4 flex flex-col items-center">
                <Image
                  src={`/${qrCode.pngname}`}
                  alt="Verus Login QR Code"
                  width={250}
                  height={250}
                />
                <p className="mt-4 text-center text-sm">
                  Or click: <a href={qrCode.deeplink} className="text-blue-500 hover:underline break-all">{qrCode.deeplink}</a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
