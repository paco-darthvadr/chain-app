'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import Link from 'next/link';

interface GameOverProps {
  game: any;
  winnerName: string;
  onRematch: () => void;
  rematchOffered: boolean;
  currentPlayer?: 'white' | 'black' | null;
}

const GameOver: React.FC<GameOverProps> = ({ game, winnerName, onRematch, rematchOffered, currentPlayer }) => {
  const [blockchainStatus, setBlockchainStatus] = useState<'idle' | 'verifying' | 'verified' | 'storing' | 'stored' | 'failed'>(
    game?.blockchainTxId && game.blockchainTxId !== 'PROCESSING' ? 'stored' : 'idle'
  );
  const [blockchainMessage, setBlockchainMessage] = useState('');
  const [gameSession, setGameSession] = useState<any>(null);
  const [storageMode, setStorageMode] = useState<'normal' | 'tournament'>('normal');
  const [showcaseClosingSig, setShowcaseClosingSig] = useState('');
  const [showcaseClosingSubmitting, setShowcaseClosingSubmitting] = useState(false);
  const [showcaseClosingDone, setShowcaseClosingDone] = useState(false);
  const [showcaseClosingError, setShowcaseClosingError] = useState<string | null>(null);

  const isShowcase = game?.mode === 'showcase';
  const isNormal = game?.mode === 'normal';
  const hasChainSupport = isShowcase || isNormal;

  // Trigger confetti
  useEffect(() => {
    if (game?.status === 'COMPLETED' && winnerName) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [game?.status, winnerName]);

  // Fetch game session data on mount, auto-verify if not yet verified
  useEffect(() => {
    if (!game?.id || !hasChainSupport) return;
    (async () => {
      try {
        const res = await fetch(`/api/game/${game.id}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.gameSession?.verifiedAt) {
          setGameSession(data.gameSession);
          setBlockchainStatus('verified');
          return;
        }

        // Auto-verify the hash chain (works for both normal and showcase)
        setBlockchainStatus('verifying');
        setBlockchainMessage('Verifying move chain...');

        const verifyRes = await fetch(`/api/game/${game.id}/verify`, { method: 'POST' });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.gameSession) {
            setGameSession(verifyData.gameSession);
            setBlockchainStatus('verified');
          } else {
            if (data.gameSession) setGameSession(data.gameSession);
            setBlockchainStatus('idle');
          }
        } else {
          if (data.gameSession) setGameSession(data.gameSession);
          setBlockchainStatus('idle');
        }
      } catch (e) {
        setBlockchainStatus('idle');
      }
    })();
  }, [game?.id, game?.mode, hasChainSupport]);

  const handleVerifyAndStore = async () => {
    if (!game?.id) return;

    setBlockchainStatus('verifying');
    setBlockchainMessage('Verifying move chain and storing on blockchain...');

    try {
      const res = await fetch(`/api/game/${game.id}/store-blockchain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: storageMode === 'tournament' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setBlockchainStatus('stored');
        setBlockchainMessage(`Stored on blockchain! SubID: ${data.subIdName || ''}`);
        if (data.transactionId) {
          setBlockchainMessage(prev => prev + ` | TX: ${data.transactionId.substring(0, 16)}...`);
        }
      } else {
        setBlockchainStatus('failed');
        setBlockchainMessage(data.error || 'Storage failed');
      }
    } catch (error: any) {
      setBlockchainStatus('failed');
      setBlockchainMessage(error.message || 'Network error');
    }
  };

  const playerVerusId = (() => {
    const player = currentPlayer === 'white' ? game?.whitePlayer : game?.blackPlayer;
    return player?.displayName ? `${player.displayName}@` : player?.verusId || '';
  })();

  const [showcaseWaitingForOpponent, setShowcaseWaitingForOpponent] = useState(false);

  const handleShowcaseClosingSign = async () => {
    if (!showcaseClosingSig.trim() || !gameSession?.gameHash) return;
    setShowcaseClosingSubmitting(true);
    setShowcaseClosingError(null);
    try {
      const res = await fetch(`/api/game/${game.id}/showcase-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'close',
          player: currentPlayer,
          signature: showcaseClosingSig.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowcaseClosingDone(true);
        // Check if both players have signed before storing
        const checkRes = await fetch(`/api/game/${game.id}`);
        const checkData = await checkRes.json();
        const session = checkData.gameSession;
        if (session?.whiteFinalSig && session?.blackFinalSig) {
          handleVerifyAndStore();
        } else {
          setShowcaseWaitingForOpponent(true);
        }
      } else {
        setShowcaseClosingError(data.error || 'Signature verification failed');
      }
    } catch {
      setShowcaseClosingError('Network error');
    }
    setShowcaseClosingSubmitting(false);
  };

  // Poll for opponent's closing signature
  useEffect(() => {
    if (!showcaseWaitingForOpponent || !isShowcase) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game/${game.id}`);
        const data = await res.json();
        const session = data.gameSession;
        if (session?.whiteFinalSig && session?.blackFinalSig) {
          clearInterval(interval);
          setShowcaseWaitingForOpponent(false);
          handleVerifyAndStore();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [showcaseWaitingForOpponent, isShowcase, game?.id]);

  const moveCount = (() => {
    try {
      const bs = game?.boardState;
      if (bs?.moves) return bs.moves.length;
    } catch {}
    return '?';
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4 text-center space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold">
          {winnerName ? `${winnerName} wins!` : "Game Over"}
        </h2>

        {/* Game Summary */}
        <div className="text-left text-sm space-y-2 bg-muted p-3 rounded-md">
          <div className="flex justify-between">
            <span className="text-muted-foreground">White:</span>
            <span className="font-medium">{game?.whitePlayer?.displayName || game?.whitePlayer?.verusId || '?'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Black:</span>
            <span className="font-medium">{game?.blackPlayer?.displayName || game?.blackPlayer?.verusId || '?'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Moves:</span>
            <span className="font-medium">{moveCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mode:</span>
            <span className="font-medium">{game?.mode || 'original'}</span>
          </div>
          {gameSession?.subIdName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">SubID:</span>
              <span className="font-mono text-xs">{gameSession.subIdName}.chessgame@</span>
            </div>
          )}
        </div>

        {/* Hash Chain Info (Normal + Showcase) */}
        {hasChainSupport && gameSession && (
          <div className="text-left text-xs space-y-1 bg-muted p-3 rounded-md font-mono">
            <p className="text-muted-foreground text-sm font-sans font-medium mb-2">Hash Chain</p>
            {gameSession.gameHash && (
              <div>
                <span className="text-muted-foreground">Game Hash: </span>
                <span className="break-all">{gameSession.gameHash}</span>
              </div>
            )}
            {gameSession.verifiedAt && (
              <div className="text-green-600">
                Chain verified at {new Date(gameSession.verifiedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {/* Showcase: Closing Signature */}
        {isShowcase && gameSession?.gameHash && !showcaseClosingDone && blockchainStatus !== 'stored' && (
          <div className="space-y-3 border-t border-border pt-4 mt-4 text-left">
            <h4 className="font-medium text-sm">Sign to confirm result</h4>
            <div className="relative">
              <div className="bg-muted p-2 pr-10 rounded font-mono text-xs break-all">
                verus -chain=VRSCTEST signmessage &quot;{playerVerusId}&quot; &quot;{gameSession.gameHash}&quot;
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`verus -chain=VRSCTEST signmessage "${playerVerusId}" "${gameSession.gameHash}"`);
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded bg-muted-foreground/10 hover:bg-muted-foreground/20 transition-colors"
                title="Copy command"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
            <textarea
              value={showcaseClosingSig}
              onChange={(e) => setShowcaseClosingSig(e.target.value)}
              placeholder="Paste closing signature here"
              rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-xs font-mono"
            />
            {showcaseClosingError && <p className="text-red-500 text-xs">{showcaseClosingError}</p>}
            <button
              onClick={handleShowcaseClosingSign}
              disabled={showcaseClosingSubmitting || !showcaseClosingSig.trim()}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {showcaseClosingSubmitting ? 'Verifying...' : 'Submit Closing Signature & Store on Chain'}
            </button>
          </div>
        )}
        {isShowcase && showcaseClosingDone && showcaseWaitingForOpponent && (
          <div className="text-center space-y-2 py-2">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            <p className="text-sm text-muted-foreground">Your signature submitted. Waiting for opponent to sign...</p>
          </div>
        )}
        {isShowcase && showcaseClosingDone && !showcaseWaitingForOpponent && blockchainStatus === 'verifying' && (
          <div className="text-yellow-600 text-sm py-2">
            <div className="animate-pulse">{blockchainMessage || 'Both signatures received. Storing final record on chain...'}</div>
          </div>
        )}

        {/* Normal: Storage Mode Toggle */}
        {isNormal && (blockchainStatus === 'idle' || blockchainStatus === 'verified' || blockchainStatus === 'failed') && (
          <div className="text-left text-sm bg-muted p-3 rounded-md space-y-2">
            <p className="font-medium">Storage mode:</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="storageMode"
                checked={storageMode === 'normal'}
                onChange={() => setStorageMode('normal')}
                className="accent-primary"
              />
              <span>Normal</span>
              <span className="text-muted-foreground text-xs">- game data + final signatures</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="storageMode"
                checked={storageMode === 'tournament'}
                onChange={() => setStorageMode('tournament')}
                className="accent-primary"
              />
              <span>Tournament</span>
              <span className="text-muted-foreground text-xs">- includes all per-move signatures</span>
            </label>
          </div>
        )}

        {/* Blockchain Storage Status (Normal + Showcase) */}
        {hasChainSupport && (
          <div className="space-y-2">
            {isNormal && blockchainStatus === 'idle' && (
              <button
                onClick={handleVerifyAndStore}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
              >
                Verify & Store on Blockchain
              </button>
            )}
            {isNormal && blockchainStatus === 'verified' && (
              <button
                onClick={handleVerifyAndStore}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
              >
                Store on Blockchain
              </button>
            )}
            {blockchainStatus === 'stored' && (
              <div className="text-green-600 text-sm py-2 bg-green-500/10 rounded p-2">
                {blockchainMessage}
              </div>
            )}
            {blockchainStatus === 'failed' && (
              <div className="space-y-2">
                <div className="text-red-600 text-sm">{blockchainMessage}</div>
                <button
                  onClick={handleVerifyAndStore}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors text-sm"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {!rematchOffered && (
            <button
              onClick={onRematch}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
            >
              Offer Rematch
            </button>
          )}
          {rematchOffered && (
            <p className="text-sm text-muted-foreground">Rematch offered, waiting for opponent...</p>
          )}
          <Link
            href="/dashboard"
            className="w-full bg-muted text-foreground py-2 px-4 rounded hover:bg-muted/80 transition-colors inline-block text-center"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GameOver;
