import { getGame } from './actions';
import GameClient from './GameClient';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

interface GamePageProps {
  params: { gameId: string };
}

export default async function GamePage({ params }: GamePageProps) {
  const game = await getGame(params.gameId);

  if (!game) {
    return (
      <DashboardLayout>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Game not found</h1>
          <p>This game may have been deleted or never existed.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <GameClient game={game} />
    </DashboardLayout>
  );
}