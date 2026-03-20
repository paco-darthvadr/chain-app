"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { io } from 'socket.io-client';
import { getGameConfig } from '@/app/games/registry';

interface OnChainGame {
  subIdName: string;
  fullName: string;
  identityAddress: string;
  blockheight: number;
  txid: string;
  gameType: string;
  version: string;
  player1: string;
  player2: string;
  player1Name: string | null;
  player2Name: string | null;
  winner: string;
  winnerName: string | null;
  result: string;
  moves: string[];
  moveCount: number;
  duration: number;
  startedAt: number;
  gameHash: string;
  player1Sig: string;
  player2Sig: string;
  mode: string;
  moveSigs: string[] | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}

function truncate(str: string, len: number = 12): string {
  if (!str || str.length <= len) return str;
  return str.substring(0, len) + '...';
}

function PlayerDisplay({ name, address }: { name: string | null; address: string }) {
  if (name) return <span className="font-medium">{name}</span>;
  return <span className="font-mono text-xs">{truncate(address, 16)}</span>;
}

function MoveList({ moves }: { moves: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayMoves = expanded ? moves : moves.slice(0, 10);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {displayMoves.map((move, i) => (
          <span
            key={i}
            className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${
              i % 2 === 0
                ? 'bg-foreground/10 text-foreground'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : '...'}{move}
          </span>
        ))}
      </div>
      {moves.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline mt-1"
        >
          {expanded ? 'Show less' : `+${moves.length - 10} more moves`}
        </button>
      )}
    </div>
  );
}

function OnChainGameCard({ game, player1Label, player2Label }: { game: OnChainGame; player1Label: string; player2Label: string }) {
  const [showDetails, setShowDetails] = useState(false);

  const player1Display = game.player1;
  const player2Display = game.player2;
  const winnerDisplay = game.winner;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {game.subIdName.replace('game', 'Game #')}
          </CardTitle>
          <span className={`text-xs px-2 py-1 rounded-full ${
            game.mode === 'tournament'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {game.mode}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {player1Display} vs {player2Display}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {/* Result */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Result:</span>
            <span className="text-sm font-medium capitalize">{game.result}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Winner:</span>
            <span className="text-sm font-medium text-green-500">{winnerDisplay}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded p-2">
            <div className="text-lg font-bold">{game.moveCount}</div>
            <div className="text-xs text-muted-foreground">Moves</div>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <div className="text-lg font-bold">{formatDuration(game.duration)}</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <div className="text-lg font-bold">{game.blockheight}</div>
            <div className="text-xs text-muted-foreground">Block</div>
          </div>
        </div>

        {/* Moves */}
        <MoveList moves={game.moves} />

        {/* Expandable details */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div>
              <span className="text-xs text-muted-foreground">Game Hash:</span>
              <p className="font-mono text-xs break-all">{game.gameHash}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{player1Label} Sig:</span>
              <p className="font-mono text-xs break-all">{game.player1Sig}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{player2Label} Sig:</span>
              <p className="font-mono text-xs break-all">{game.player2Sig}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">SubID:</span>
              <p className="font-mono text-xs">{game.fullName}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Identity Address:</span>
              <p className="font-mono text-xs break-all">{game.identityAddress}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">TX ID:</span>
              <p className="font-mono text-xs break-all">{game.txid}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Started:</span>
              <p className="text-xs">{formatDate(game.startedAt)}</p>
            </div>
            {game.moveSigs && (
              <div>
                <span className="text-xs text-muted-foreground">
                  Move Signatures: {game.moveSigs.length} signed moves
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-primary hover:underline"
        >
          {showDetails ? 'Hide chain details' : 'View chain details'}
        </button>
      </CardFooter>
    </Card>
  );
}

export default function GameList({ gameType }: { gameType: string }) {
  const [chainGames, setChainGames] = useState<OnChainGame[]>([]);
  const [loadingChain, setLoadingChain] = useState(true);
  const router = useRouter();

  const config = getGameConfig(gameType);
  const player1Label = config.player1Label;
  const player2Label = config.player2Label;
  const parentIdentityName = config.parentIdentityName;

  // Fetch on-chain games
  useEffect(() => {
    async function fetchChainGames() {
      try {
        const res = await fetch(`/api/chain/games?gameType=${gameType}`);
        if (res.ok) {
          const data = await res.json();
          setChainGames(data.games || []);
        }
      } catch (err) {
        console.error('Failed to fetch chain games:', err);
      } finally {
        setLoadingChain(false);
      }
    }
    fetchChainGames();
  }, [gameType]);

  // Socket for live updates
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002');

    socket.on('refresh-game-list', () => {
      router.refresh();
    });

    return () => { socket.disconnect(); };
  }, [router]);

  return (
    <div>
      {loadingChain ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          <p className="text-muted-foreground mt-3">Fetching games from Verus blockchain...</p>
        </div>
      ) : chainGames.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No games found on chain yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete a game and store it to see it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chainGames.map((game) => (
            <OnChainGameCard
              key={game.subIdName}
              game={game}
              player1Label={player1Label}
              player2Label={player2Label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
