// components/dashboard/ChallengeInbox.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChallenges, Challenge } from './ChallengeContext';
import { getGlobalSocket } from './SocketRegistration';
import { getTheme } from '@/app/utils/board-themes';
import { getGameConfig } from '@/app/games/registry';

function StatusDot({ status }: { status: string }) {
  const color = status === 'available' ? 'bg-green-500'
    : status === 'in-game' ? 'bg-orange-500'
    : 'bg-gray-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function ChallengeItem({ challenge, currentUserId }: { challenge: Challenge; currentUserId: string }) {
  const { removeChallenge, markAcceptedWaiting } = useChallenges();
  const socket = getGlobalSocket();

  const handleAccept = () => {
    if (!socket) return;
    const status = challenge.challengerStatus;

    if (status === 'available') {
      // Challenger is available — create game immediately via existing accept flow
      socket.emit('start-game', {
        challengerId: challenge.challengerId,
        challengeeId: currentUserId,
        mode: challenge.mode,
        boardTheme: challenge.boardTheme,
        logoMode: challenge.logoMode,
        gameType: challenge.gameType || 'chess',
      });
      removeChallenge(challenge.challengerId);
    } else {
      // Challenger is busy — send ready notification
      socket.emit('challenge-accepted-busy', {
        challengerId: challenge.challengerId,
        acceptorId: currentUserId,
        acceptorName: localStorage.getItem('currentUserName') || currentUserId,
        mode: challenge.mode,
        boardTheme: challenge.boardTheme,
        logoMode: challenge.logoMode,
        gameType: challenge.gameType || 'chess',
      });
      markAcceptedWaiting(challenge.challengerId);
    }
  };

  const handleDecline = () => {
    if (!socket) return;
    const currentUserName = localStorage.getItem('currentUserName') || currentUserId;
    socket.emit('challenge-declined', {
      challengerId: challenge.challengerId,
      declinerName: currentUserName,
    });
    removeChallenge(challenge.challengerId);
  };

  const handleCancel = () => {
    if (!socket) return;
    socket.emit('challenge-cancel', {
      challengerId: currentUserId,
      challengeeId: challenge.challengeeId,
    });
    removeChallenge(challenge.challengerId);
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('start-game', {
      challengerId: currentUserId,
      challengeeId: challenge.challengeeId,
      mode: challenge.mode,
      boardTheme: challenge.boardTheme,
      logoMode: challenge.logoMode,
      gameType: challenge.gameType || 'chess',
    });
    removeChallenge(challenge.challengerId);
  };

  if (challenge.state === 'incoming') {
    const themeName = getTheme(challenge.boardTheme).name;
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusDot status={challenge.challengerStatus} />
            <span className="font-medium text-sm">{challenge.challengerName}</span>
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo(challenge.timestamp)}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {challenge.gameType ? getGameConfig(challenge.gameType).displayName : 'Chess'}
          {' · '}
          {challenge.mode === 'showcase' ? 'Showcase' : 'Normal'}
          {challenge.boardTheme !== 'classic' && ` · ${themeName}`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleAccept}
            disabled={challenge.challengerStatus === 'offline'}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline}>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  if (challenge.state === 'sent') {
    const sentThemeName = getTheme(challenge.boardTheme).name;
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm">Sent to <span className="font-medium">{challenge.challengerName}</span></span>
          <span className="text-xs text-muted-foreground">{timeAgo(challenge.timestamp)}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {challenge.gameType ? getGameConfig(challenge.gameType).displayName : 'Chess'}
          {' · '}
          {challenge.mode === 'showcase' ? 'Showcase' : 'Normal'}
          {challenge.boardTheme !== 'classic' && ` · ${sentThemeName}`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (challenge.state === 'accepted-waiting') {
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusDot status={challenge.challengerStatus} />
            <span className="font-medium text-sm">{challenge.challengerName}</span>
          </div>
        </div>
        <p className="text-xs text-amber-400">Accepted — waiting for {challenge.challengerName}</p>
      </div>
    );
  }

  if (challenge.state === 'opponent-ready') {
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusDot status={challenge.challengerStatus} />
            <span className="font-medium text-sm">{challenge.acceptorName || 'Opponent'}</span>
          </div>
        </div>
        <p className="text-xs text-green-400 mb-2">Ready to play!</p>
        <Button size="sm" variant="default" onClick={handleStartGame}
          disabled={challenge.challengerStatus !== 'available'}>
          Start Game
        </Button>
      </div>
    );
  }

  return null;
}

export default function ChallengeInbox() {
  const [open, setOpen] = useState(false);
  const { challenges } = useChallenges();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const count = challenges.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="relative">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Challenges</h3>
          </div>
          {challenges.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No pending challenges
            </div>
          ) : (
            challenges.map((c, i) => (
              <ChallengeItem key={`${c.challengerId}-${c.state}-${i}`} challenge={c} currentUserId={currentUserId || ''} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
