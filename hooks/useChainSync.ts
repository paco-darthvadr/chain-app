'use client';

import { useState, useEffect, useRef } from 'react';

interface ChainSyncState {
  syncedMoves: number;
  totalMoves: number;
  mode: string;
}

/**
 * Poll chain sync status for showcase games.
 * Returns how many moves are confirmed on-chain vs total moves.
 * Only polls when mode is 'showcase' and game is not over.
 */
export function useChainSync(gameId: string, mode: string, gameOver: boolean) {
  const [sync, setSync] = useState<ChainSyncState>({ syncedMoves: 0, totalMoves: 0, mode });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (mode !== 'showcase' || !gameId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${gameId}/chain-sync`);
        if (res.ok) {
          const data = await res.json();
          setSync(data);
        }
      } catch {
        // Silently ignore poll errors
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameId, mode]);

  // When game ends, do one final poll then stop
  useEffect(() => {
    if (gameOver && mode === 'showcase') {
      // Final poll after a short delay to catch the last batch
      const timeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/game/${gameId}/chain-sync`);
          if (res.ok) setSync(await res.json());
        } catch {}
      }, 2000);
      // Stop polling
      if (intervalRef.current) clearInterval(intervalRef.current);
      return () => clearTimeout(timeout);
    }
  }, [gameOver, gameId, mode]);

  return sync;
}
