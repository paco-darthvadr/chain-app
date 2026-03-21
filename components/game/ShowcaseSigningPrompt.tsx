'use client';

import React, { useState } from 'react';

interface ShowcaseSigningPromptProps {
  gameId: string;
  player: 'white' | 'black';
  playerVerusId: string;
  phase: 'open' | 'close';
  messageToSign: string;
  onSigned: () => void;
  onBothSigned?: () => void;
  onLeave?: () => void;
  player1Label?: string;
  player2Label?: string;
}

export default function ShowcaseSigningPrompt({
  gameId, player, playerVerusId, phase, messageToSign, onSigned, onBothSigned, onLeave,
  player1Label = 'White', player2Label = 'Black',
}: ShowcaseSigningPromptProps) {
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const signCommand = `verus -chain=VRSCTEST signmessage "${playerVerusId}" '${messageToSign}'`;

  // Check if we already signed on mount (handles page refresh)
  React.useEffect(() => {
    if (phase !== 'open') return;
    (async () => {
      try {
        const res = await fetch(`/api/game/${gameId}/showcase-sign`);
        const data = await res.json();
        const mySide = player === 'white' ? 'player1HasSigned' : 'player2HasSigned';
        if (data[mySide]) {
          if (data.player1HasSigned && data.player2HasSigned) {
            onBothSigned?.();
          } else {
            setWaitingForOpponent(true);
          }
        }
      } catch {}
    })();
  }, [phase, gameId, player]);

  const handleCopy = () => {
    navigator.clipboard.writeText(signCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!signature.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/game/${gameId}/showcase-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, player, signature: signature.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onSigned();
        if (data.bothSigned) {
          // Both players signed — unlock the board
          onBothSigned?.();
        } else {
          // Only this player signed — wait for opponent
          setWaitingForOpponent(true);
        }
      } else {
        setError(data.error || 'Signature verification failed');
      }
    } catch {
      setError('Network error');
    }
    setSubmitting(false);
  };

  // Poll for opponent's signature when waiting
  React.useEffect(() => {
    if (!waitingForOpponent || phase !== 'open') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game/${gameId}/showcase-sign`);
        const data = await res.json();
        if (data.player1HasSigned && data.player2HasSigned) {
          clearInterval(interval);
          onBothSigned?.();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [waitingForOpponent, phase, gameId, onBothSigned]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl space-y-4">
        <h2 className="text-xl font-bold">
          {phase === 'open' ? 'Sign Opening Commitment' : 'Sign Game Result'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {phase === 'open'
            ? 'Both players must sign to confirm the game setup before play begins.'
            : 'Sign the final game hash to confirm the result.'}
        </p>

        {/* Game summary — show what you're actually signing */}
        {(() => {
          try {
            const data = JSON.parse(messageToSign);
            return (
              <div className="text-left text-sm space-y-1 bg-muted p-3 rounded-md">
                <p className="font-medium text-muted-foreground mb-2">You are signing:</p>
                {data[player1Label.toLowerCase()] && <div className="flex justify-between"><span className="text-muted-foreground">{player1Label}:</span><span className="font-medium">{data[player1Label.toLowerCase()]}</span></div>}
                {data[player2Label.toLowerCase()] && <div className="flex justify-between"><span className="text-muted-foreground">{player2Label}:</span><span className="font-medium">{data[player2Label.toLowerCase()]}</span></div>}
                {data.gameNumber && <div className="flex justify-between"><span className="text-muted-foreground">Game:</span><span className="font-mono text-xs">{data.gameNumber}</span></div>}
                {data.startedAt && <div className="flex justify-between"><span className="text-muted-foreground">Started:</span><span className="text-xs">{new Date(data.startedAt).toLocaleString()}</span></div>}
              </div>
            );
          } catch {
            // Not JSON (e.g. closing hash) — show raw
            return (
              <div className="space-y-2">
                <label className="text-sm font-medium">Message to sign:</label>
                <div className="bg-muted p-3 rounded-md font-mono text-xs break-all">
                  {messageToSign}
                </div>
              </div>
            );
          }
        })()}

        <div className="space-y-2">
          <label className="text-sm font-medium">Sign command:</label>
          <div className="relative">
            <div className="bg-muted p-3 pr-12 rounded-md font-mono text-xs break-all">
              {signCommand}
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded bg-muted-foreground/10 hover:bg-muted-foreground/20 transition-colors"
              title="Copy command"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Paste signature:</label>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Paste the signature output here"
            rows={3}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm font-mono"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {waitingForOpponent ? (
          <div className="text-center space-y-2">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            <p className="text-sm text-muted-foreground">Your signature submitted. Waiting for opponent to sign...</p>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !signature.trim()}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            {submitting ? 'Verifying...' : 'Submit Signature'}
          </button>
        )}

        {onLeave && (
          <button
            onClick={onLeave}
            className="w-full px-4 py-2 rounded-md border border-border text-muted-foreground text-sm hover:bg-muted transition-colors"
          >
            Leave Game
          </button>
        )}
      </div>
    </div>
  );
}
