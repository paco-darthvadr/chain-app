import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Crown } from 'lucide-react';
import Image from 'next/image';

interface LeaderboardUser {
  id: string;
  verusId: string;
  displayName: string | null;
  avatarUrl: string | null;
  winCount: number;
}

const rankColors = [
  'bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900', // 1st
  'bg-gradient-to-r from-gray-300 to-gray-500 text-gray-900',      // 2nd
  'bg-gradient-to-r from-amber-500 to-orange-600 text-orange-900', // 3rd
];

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const res = await fetch(`${baseUrl}/api/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <Card className="w-full relative">
      <CardHeader className="relative">
        <CardTitle>Leaderboard</CardTitle>
        <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem' }}>
          <Image src="/img/logo.png" alt="Logo" width={40} height={40} style={{ width: 40, height: 40 }} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center text-muted-foreground">No data yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-2 py-1">Rank</th>
                  <th className="px-2 py-1">Player</th>
                  <th className="px-2 py-1">Wins</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map((user, idx) => (
                  <tr
                    key={user.id}
                    className={`rounded-lg ${idx < 3 ? rankColors[idx] : 'hover:bg-accent/30'} transition`}
                  >
                    <td className="px-2 py-2 font-bold text-lg text-center align-middle">
                      {idx === 0 && <Crown className="inline h-6 w-6 text-yellow-500 mr-1 align-middle" />}
                      {idx === 1 && <Crown className="inline h-6 w-6 text-gray-400 mr-1 align-middle" />}
                      {idx === 2 && <Crown className="inline h-6 w-6 text-orange-400 mr-1 align-middle" />}
                      <span className="align-middle">{idx + 1}</span>
                    </td>
                    <td className="flex items-center gap-3 px-2 py-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.verusId} />
                        <AvatarFallback>{(user.displayName || user.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-base">{user.displayName || user.verusId}</span>
                    </td>
                    <td className="px-2 py-2 font-bold text-blue-700 text-lg">{user.winCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 