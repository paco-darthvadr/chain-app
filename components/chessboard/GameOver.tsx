'use client';

import React from 'react';
import { useWindowSize } from 'react-use';
import Confetti from 'react-confetti';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface GameOverProps {
  winnerName: string;
  onRematch: () => void;
  rematchOffered: boolean;
}

const GameOver: React.FC<GameOverProps> = ({ winnerName, onRematch, rematchOffered }) => {
  const { width, height } = useWindowSize();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
      <div className="bg-card p-8 rounded-lg shadow-xl text-center border">
        <h2 className="text-3xl font-bold mb-4">Game Over</h2>
        <p className="text-xl text-green-400 mb-6">{winnerName} is the winner!</p>
        <div className="flex justify-center gap-4 mt-6">
          <Button onClick={onRematch} disabled={rematchOffered}>
            {rematchOffered ? 'Rematch Offered' : 'Offer Rematch'}
          </Button>
          <Link href="/users" passHref>
            <Button variant="outline">Back to Users</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GameOver; 