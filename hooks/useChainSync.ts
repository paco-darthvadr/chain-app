'use client';

import { useState, useEffect, useRef } from 'react';

export interface ChainSyncState {
  sentMoves: number;
  confirmedMoves: number;
  totalMoves: number;
  mode: string;
}

/**
 * Poll chain sync status for showcase games.
 * Returns sent (mempool), confirmed (on-chain), and total move counts.
 * Only polls when mode is 'showcase'.
 */
export function useChainSync(gameId: string, mode: string, gameOver: boolean) {
  const [sync, setSync] = useState<ChainSyncState>({ sentMoves: 0, confirmedMoves: 0, totalMoves: 0, mode });
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

    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameId, mode]);

  // When game ends, do one final poll then stop
  useEffect(() => {
    if (gameOver && mode === 'showcase') {
      const timeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/game/${gameId}/chain-sync`);
          if (res.ok) setSync(await res.json());
        } catch {}
      }, 2000);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return () => clearTimeout(timeout);
    }
  }, [gameOver, gameId, mode]);

  return sync;
}
