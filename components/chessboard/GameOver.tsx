'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import Link from 'next/link';

interface GameOverProps {
  game: any;
  winnerName: string;
  onRematch: () => void;
  rematchOffered: boolean;
}

const GameOver: React.FC<GameOverProps> = ({ game, winnerName, onRematch, rematchOffered }) => {
  const [blockchainStatus, setBlockchainStatus] = useState<'idle' | 'verifying' | 'verified' | 'storing' | 'stored' | 'failed'>(
    game?.blockchainTxId && game.blockchainTxId !== 'PROCESSING' ? 'stored' : 'idle'
  );
  const [blockchainMessage, setBlockchainMessage] = useState('');
  const [gameSession, setGameSession] = useState<any>(null);
  const [storageMode, setStorageMode] = useState<'normal' | 'tournament'>('normal');

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
    if (!game?.id || game?.mode !== 'normal') return;
    (async () => {
      try {
        // First fetch current session state
        const res = await fetch(`/api/game/${game.id}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.gameSession?.verifiedAt) {
          // Already verified
          setGameSession(data.gameSession);
          setBlockchainStatus('verified');
          return;
        }

        // Not verified yet — trigger verification via a verify-only endpoint
        // We call store-blockchain which runs onGameEnd (verify) then storeOnChain
        // But we just want verification. Let's call a lightweight verify endpoint.
        // For now, we trigger onGameEnd by fetching the session after a short delay
        // to allow the server action endGame to propagate.
        setBlockchainStatus('verifying');
        setBlockchainMessage('Verifying move chain...');

        const verifyRes = await fetch(`/api/game/${game.id}/verify`, { method: 'POST' });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.gameSession) {
            setGameSession(verifyData.gameSession);
            setBlockchainStatus('verified');
          } else {
            setBlockchainStatus('idle');
          }
        } else {
          // Fallback: just show what we have
          if (data.gameSession) setGameSession(data.gameSession);
          setBlockchainStatus('idle');
        }
      } catch (e) {
        setBlockchainStatus('idle');
      }
    })();
  }, [game?.id, game?.mode]);

  const handleVerifyAndStore = async () => {
    if (!game?.id) return;

    setBlockchainStatus('verifying');
    setBlockchainMessage('Verifying move chain and signatures...');

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

        {/* Hash Chain Info (Normal mode) */}
        {game?.mode === 'normal' && gameSession && (
          <div className="text-left text-xs space-y-1 bg-muted p-3 rounded-md font-mono">
            <p className="text-muted-foreground text-sm font-sans font-medium mb-2">Hash Chain</p>
            {gameSession.gameHash && (
              <div>
                <span className="text-muted-foreground">Game Hash: </span>
                <span className="break-all">{gameSession.gameHash}</span>
              </div>
            )}
            {gameSession.whiteFinalSig && (
              <div>
                <span className="text-muted-foreground">White Sig: </span>
                <span className="break-all">{gameSession.whiteFinalSig.substring(0, 24)}...</span>
              </div>
            )}
            {gameSession.blackFinalSig && (
              <div>
                <span className="text-muted-foreground">Black Sig: </span>
                <span className="break-all">{gameSession.blackFinalSig.substring(0, 24)}...</span>
              </div>
            )}
            {gameSession.verifiedAt && (
              <div className="text-green-600">
                Chain verified at {new Date(gameSession.verifiedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {/* Storage Mode Toggle */}
        {game?.mode === 'normal' && (blockchainStatus === 'idle' || blockchainStatus === 'verified' || blockchainStatus === 'failed') && (
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

        {/* Blockchain Storage */}
        {game?.mode === 'normal' && (
          <div className="space-y-2">
            {blockchainStatus === 'idle' && (
              <button
                onClick={handleVerifyAndStore}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
              >
                Verify & Store on Blockchain
              </button>
            )}
            {blockchainStatus === 'verified' && (
              <button
                onClick={handleVerifyAndStore}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
              >
                Store on Blockchain
              </button>
            )}
            {blockchainStatus === 'verifying' && (
              <div className="text-yellow-600 text-sm py-2">
                <div className="animate-pulse">{blockchainMessage}</div>
              </div>
            )}
            {blockchainStatus === 'storing' && (
              <div className="text-yellow-600 text-sm py-2">
                <div className="animate-pulse">{blockchainMessage}</div>
              </div>
            )}
            {blockchainStatus === 'stored' && (
              <div className="text-green-600 text-sm py-2 bg-green-50 rounded p-2">
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
