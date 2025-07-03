'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
// import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface GameOverProps {
  game: any;
  winnerName: string;
  onRematch: () => void;
  rematchOffered: boolean;
}

// Simple window size hook
const useWindowSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const updateSize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  return size;
};

const GameOver: React.FC<GameOverProps> = ({ game, winnerName, onRematch, rematchOffered }) => {
  const { width, height } = useWindowSize();
  const [blockchainStatus, setBlockchainStatus] = useState<'storing' | 'stored' | 'failed' | 'processing' | null>(null);
  const [isStoring, setIsStoring] = useState(false);
  const [blockchainMessage, setBlockchainMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Ref to track if we've already attempted to store for this gameId
  const blockchainStoredGameIds = useRef(new Set<string>());
  const processingTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  // Cleanup function to clear timeouts
  const clearProcessingTimeout = (gameId: string) => {
    const timeout = processingTimeouts.current.get(gameId);
    if (timeout) {
      clearTimeout(timeout);
      processingTimeouts.current.delete(gameId);
    }
  };

  // Function to check blockchain status
  const checkBlockchainStatus = async (gameId: string) => {
    try {
      const res = await fetch(`/api/game/${gameId}`);
      if (res.ok) {
        const gameData = await res.json();
        if (gameData.blockchainTxId && gameData.blockchainTxId !== 'PROCESSING') {
          setBlockchainStatus('stored');
          setBlockchainMessage('Game stored on blockchain successfully!');
          clearProcessingTimeout(gameId);
          return true;
        }
      }
    } catch (error) {
      console.error('Error checking blockchain status:', error);
    }
    return false;
  };

  // Function to poll for blockchain status when processing
  const pollBlockchainStatus = async (gameId: string) => {
    const pollInterval = 2000; // 2 seconds
    const maxPolls = 30; // 1 minute max
    let pollCount = 0;

    const poll = async () => {
      if (pollCount >= maxPolls) {
        setBlockchainStatus('failed');
        setBlockchainMessage('Blockchain storage timed out');
        clearProcessingTimeout(gameId);
        blockchainStoredGameIds.current.delete(gameId);
        return;
      }

      const isStored = await checkBlockchainStatus(gameId);
      if (isStored) {
        return;
      }

      pollCount++;
      setTimeout(poll, pollInterval);
    };

    poll();
  };

  useEffect(() => {
    if (
      game &&
      game.status === 'COMPLETED' &&
      !game.blockchainTxId &&
      !blockchainStoredGameIds.current.has(game.id)
    ) {
      blockchainStoredGameIds.current.add(game.id);
      setBlockchainStatus('storing');
      setBlockchainMessage('Storing on blockchain...');
      
      const storeOnBlockchain = async () => {
        setIsStoring(true);
        try {
          const res = await fetch(`/api/game/${game.id}/store-blockchain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          const data = await res.json();
          
          if (res.ok && data.success) {
            setBlockchainStatus('stored');
            setBlockchainMessage(data.message || 'Game stored on blockchain successfully!');
            clearProcessingTimeout(game.id);
          } else if (res.status === 409 && data.status === 'processing') {
            // Game is being processed by another request
            setBlockchainStatus('processing');
            setBlockchainMessage('Game is being processed for blockchain storage...');
            
            // Poll for status updates
            pollBlockchainStatus(game.id);
          } else {
            // Handle retry logic for other errors
            if (retryCount < maxRetries) {
              setRetryCount(prev => prev + 1);
              setBlockchainMessage(`Retrying... (${retryCount + 1}/${maxRetries})`);
              
              // Retry after 3 seconds
              setTimeout(() => {
                storeOnBlockchain();
              }, 3000);
            } else {
              setBlockchainStatus('failed');
              setBlockchainMessage(data.error || 'Blockchain storage failed');
              blockchainStoredGameIds.current.delete(game.id);
            }
          }
        } catch (error) {
          console.error('Blockchain storage error:', error);
          
          // Handle retry logic for network errors
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setBlockchainMessage(`Network error, retrying... (${retryCount + 1}/${maxRetries})`);
            
            // Retry after 3 seconds
            setTimeout(() => {
              storeOnBlockchain();
            }, 3000);
          } else {
            setBlockchainStatus('failed');
            setBlockchainMessage('Network error - blockchain storage failed');
            blockchainStoredGameIds.current.delete(game.id);
          }
        } finally {
          setIsStoring(false);
        }
      };
      
      storeOnBlockchain();
    }

    // Cleanup function
    return () => {
      if (game?.id) {
        clearProcessingTimeout(game.id);
      }
    };
  }, [game?.status, game?.blockchainTxId, game?.id, retryCount]);

  useEffect(() => {
    if (
      game &&
      game.status === 'COMPLETED' &&
      game.blockchainTxId &&
      game.blockchainTxId !== 'PROCESSING'
    ) {
      setBlockchainStatus('stored');
      setBlockchainMessage('Game stored on blockchain successfully!');
    }
  }, [game?.status, game?.blockchainTxId, game?.id]);

  // Trigger confetti when game is completed
  useEffect(() => {
    if (game?.status === 'COMPLETED' && winnerName) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }, 250);
    }
  }, [game?.status, winnerName]);

  const getStatusIcon = () => {
    switch (blockchainStatus) {
      case 'storing':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'stored':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (blockchainStatus) {
      case 'storing':
      case 'processing':
        return 'text-yellow-600';
      case 'stored':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4">
          {winnerName ? `🎉 ${winnerName} wins!` : "Game Over"}
        </h2>
        
        {/* Blockchain Status Display */}
        {blockchainStatus && (
          <div className={`mb-4 p-3 rounded-lg border ${getStatusColor()} bg-gray-50`}>
            <div className="flex items-center justify-center space-x-2">
              {getStatusIcon() && <span className="text-lg">{getStatusIcon()}</span>}
              <span className="text-sm font-medium">{blockchainMessage}</span>
            </div>
            {isStoring && (
              <div className="mt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mx-auto"></div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {!rematchOffered && (
            <button
              onClick={onRematch}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
            >
              Offer Rematch
            </button>
          )}
          <Link
            href="/dashboard"
            className="w-full bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors inline-block text-center"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GameOver; 