import { getGames } from './actions';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import GameList from './GameList';

export default async function GamesPage() {
  const games = await getGames();

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">Chess Games</h1>
        <p className="text-muted-foreground mb-6">
          Games stored on the Verus blockchain as SubIDs under ChessGame@
        </p>
        <GameList initialGames={games} />
      </div>
    </DashboardLayout>
  );
}
