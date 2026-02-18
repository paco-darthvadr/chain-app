'use client';

import React, { useEffect, useRef, useState } from 'react';

interface GameMovesProps {
  gameId: string;
  moves: { from: string; to: string; }[];
  playerVerusId: string;
  onStatusChange?: (moveStatuses: Record<string, 'storing' | 'stored' | 'failed' | 'processing' | null>) => void;
}

// Helper to get a unique move key
function moveKey(move: { from: string; to: string }) {
  return `${move.from}-${move.to}`;
}

const GameMoves: React.FC<GameMovesProps> = ({ gameId, moves, playerVerusId, onStatusChange }) => {
  // Track which moves have been stored on-chain
  const storedMoveKeys = useRef(new Set<string>());
  const [moveStatus, setMoveStatus] = useState<Record<string, 'storing' | 'stored' | 'failed' | 'processing' | null>>({});
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const maxRetries = 3;

  // Poll move status from database for moves in PROCESSING state
  const pollMoveStatus = async (moveKey: string) => {
    try {
      const res = await fetch(`/api/game/${gameId}/move-status?move=${moveKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.blockchainTxId && data.blockchainTxId !== 'PROCESSING') {
          // Move is confirmed on blockchain
          setMoveStatus(s => ({ ...s, [moveKey]: 'stored' }));
          storedMoveKeys.current.add(moveKey);
          return true; // Stop polling
        } else if (data.blockchainTxId === 'PROCESSING') {
          // Still processing
          setMoveStatus(s => ({ ...s, [moveKey]: 'processing' }));
          return false; // Continue polling
        }
      }
    } catch (error) {
      console.error('Error polling move status:', error);
    }
    return false; // Continue polling on error
  };

  // Start polling for moves in processing state
  useEffect(() => {
    const pollIntervals: Record<string, NodeJS.Timeout> = {};
    
    Object.entries(moveStatus).forEach(([key, status]) => {
      if (status === 'processing' && !pollIntervals[key]) {
        // Poll every 3 seconds for up to 7 minutes (140 polls)
        let pollCount = 0;
        const maxPolls = 140;
        
        pollIntervals[key] = setInterval(async () => {
          pollCount++;
          const shouldStop = await pollMoveStatus(key);
          
          if (shouldStop || pollCount >= maxPolls) {
            clearInterval(pollIntervals[key]);
            delete pollIntervals[key];
            
            // If we hit max polls without confirmation, mark as failed
            if (pollCount >= maxPolls && !shouldStop) {
              setMoveStatus(s => ({ ...s, [key]: 'failed' }));
            }
          }
        }, 3000);
      }
    });

    // Cleanup function
    return () => {
      Object.values(pollIntervals).forEach(clearInterval);
    };
  }, [moveStatus, gameId]);

  // Poll move status from backend, and show txid/explorer link when confirmed
  // Poll move status from backend is no longer needed and has been removed.

  // Store move on blockchain and start polling for confirmation
  const storeMoveOnBlockchain = async (move: { from: string; to: string }) => {
    const key = moveKey(move);
    setMoveStatus(s => ({ ...s, [key]: 'storing' }));
    try {
      // Create AbortController for 6-minute timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6 * 60 * 1000); // 6 minutes

      const res = await fetch(`/api/game/${gameId}/store-move-blockchain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move: key, player: playerVerusId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId); // Clear timeout on successful response
      
      const data = await res.json();
      if (res.ok && data.success) {
        setMoveStatus(s => ({ ...s, [key]: 'stored' }));
        storedMoveKeys.current.add(key);
      } else if (res.status === 409 && data.status === 'processing') {
        setMoveStatus(s => ({ ...s, [key]: 'processing' }));
      } else {
        setMoveStatus(s => ({ ...s, [key]: 'failed' }));
      }
    } catch (error) {
  setMoveStatus(s => ({ ...s, [key]: 'failed' }));
    }
  };

  // Watch for new moves and trigger storage and polling
  useEffect(() => {
    if (!gameId || !playerVerusId) return;
    moves.forEach(move => {
      const key = moveKey(move);
      if (!storedMoveKeys.current.has(key) && !moveStatus[key]) {
        storeMoveOnBlockchain(move);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, gameId, playerVerusId]);

  // Notify parent component when status changes
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(moveStatus);
    }
  }, [moveStatus, onStatusChange]);

  // UI: No longer show floating UI - status is handled by parent
  return null;
};

export default GameMoves;