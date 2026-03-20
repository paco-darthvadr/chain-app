"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { io } from 'socket.io-client';

interface OnChainGame {
  subIdName: string;
  fullName: string;
  identityAddress: string;
  blockheight: number;
  txid: string;
  version: string;
  white: string;
  black: string;
  whiteName: string | null;
  blackName: string | null;
  winner: string;
  winnerName: string | null;
  result: string;
  moves: string[];
  moveCount: number;
  duration: number;
  startedAt: number;
  gameHash: string;
  whiteSig: string;
  blackSig: string;
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

function OnChainGameCard({ game }: { game: OnChainGame }) {
  const [showDetails, setShowDetails] = useState(false);

  const whiteDisplay = game.white;
  const blackDisplay = game.black;
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
          {whiteDisplay} vs {blackDisplay}
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
              <span className="text-xs text-muted-foreground">White Sig:</span>
              <p className="font-mono text-xs break-all">{game.whiteSig}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Black Sig:</span>
              <p className="font-mono text-xs break-all">{game.blackSig}</p>
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

export default function GameList({ initialGames }: { initialGames: any[] }) {
  const [games, setGames] = useState(initialGames);
  const [chainGames, setChainGames] = useState<OnChainGame[]>([]);
  const [loadingChain, setLoadingChain] = useState(true);
  const [activeTab, setActiveTab] = useState<'chain' | 'local'>('chain');
  const router = useRouter();

  useEffect(() => {
    setGames(initialGames);
  }, [initialGames]);

  // Fetch on-chain games
  useEffect(() => {
    async function fetchChainGames() {
      try {
        const res = await fetch('/api/chain/games');
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
  }, []);

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
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('chain')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'chain'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          On-Chain Games ({loadingChain ? '...' : chainGames.length})
        </button>
        <button
          onClick={() => setActiveTab('local')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'local'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Local Games ({games.length})
        </button>
      </div>

      {/* On-Chain Games Tab */}
      {activeTab === 'chain' && (
        <>
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
                <OnChainGameCard key={game.subIdName} game={game} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Local Games Tab */}
      {activeTab === 'local' && (
        <>
          {games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No games found.</p>
              <Link href="/users" className="text-primary hover:underline mt-2 inline-block">
                Challenge someone to start a game
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {games.map((game: any) => {
                const whiteName = game.whitePlayer?.displayName
                  ? `${game.whitePlayer.displayName}@`
                  : game.whitePlayer?.verusId || 'White';
                const blackName = game.blackPlayer?.displayName
                  ? `${game.blackPlayer.displayName}@`
                  : game.blackPlayer?.verusId || 'Black';
                const subIdName = game.gameSession?.subIdName;
                const isStored = !!game.blockchainTxId && game.blockchainTxId !== 'PROCESSING';
                const isCompleted = game.status === 'COMPLETED';
                const hasSigs = !!(game.gameSession?.whiteFinalSig && game.gameSession?.blackFinalSig);

                return (
                  <Card key={game.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {subIdName ? subIdName.replace('game', 'Game #') : 'Game'}
                        </CardTitle>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          game.mode === 'showcase'
                            ? 'bg-purple-500/20 text-purple-400'
                            : game.mode === 'normal'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {game.mode || 'original'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {whiteName} vs {blackName}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="capitalize">{game.status.toLowerCase().replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Created:</span>
                          <span>{new Date(game.createdAt).toLocaleDateString()}</span>
                        </div>
                        {game.winner && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Winner:</span>
                            <span className="font-medium text-green-500">
                              {game.winner === game.whitePlayerId ? whiteName : game.winner === game.blackPlayerId ? blackName : game.winner}
                            </span>
                          </div>
                        )}
                        {subIdName && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">SubID:</span>
                            <span className="font-mono text-xs">{subIdName}.ChessGame@</span>
                          </div>
                        )}

                        {/* Chain status */}
                        {isStored ? (
                          <p className="text-xs text-green-500 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Stored on chain
                          </p>
                        ) : isCompleted && subIdName ? (
                          <p className="text-xs text-yellow-500">
                            {hasSigs ? 'Signed, not stored yet' : 'Not signed or stored'}
                          </p>
                        ) : null}

                        <Link
                          href={`/game/${game.id}`}
                          className="inline-block mt-3 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity text-sm w-full text-center"
                        >
                          {game.status === 'IN_PROGRESS' ? 'Join Game' : isCompleted && !isStored ? 'Sign & Store' : 'View Game'}
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
