"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { io } from 'socket.io-client';

export default function GameList({ initialGames }: { initialGames: any[] }) {
  const [games, setGames] = useState(initialGames);
  const router = useRouter();

  useEffect(() => {
    // Re-sync server-side games with client-side on component mount/update
    setGames(initialGames);
  }, [initialGames]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to WebSocket server for game list updates.');
    });

    socket.on('refresh-game-list', () => {
      console.log('Received refresh-game-list event. Refreshing router...');
      router.refresh();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server.');
    });

    // Cleanup on component unmount
    return () => {
      socket.disconnect();
    };
  }, [router]);

  return (
    <>
      {games.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No active games found.</p>
          <Link href="/users" className="text-blue-500 hover:underline mt-2 inline-block">
            Challenge someone to start a game
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game: any) => (
            <Card key={game.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">
                  {game.whitePlayer.verusId} vs {game.blackPlayer.verusId}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Status: <span className="capitalize">{game.status.toLowerCase().replace('_', ' ')}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(game.createdAt).toLocaleDateString()}
                  </p>
                  {game.winner && (
                    <p className="text-sm font-medium text-green-600">
                      Winner: {game.winner}
                    </p>
                  )}
                  <Link 
                    href={`/game/${game.id}`}
                    className="inline-block mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    {game.status === 'IN_PROGRESS' ? 'Join Game' : 'View Game'}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
} 