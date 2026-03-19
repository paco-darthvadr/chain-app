import { NextResponse } from 'next/server';
import { listGamesFromChain, readGameFromChain } from '@/app/utils/chain-reader';

// GET /api/chain/games — List all games stored on-chain
// Optional query: ?game=game0008 to fetch a single game
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const singleGame = searchParams.get('game');

    if (singleGame) {
      const game = await readGameFromChain(singleGame);
      if (!game) {
        return NextResponse.json(
          { error: `${singleGame} not found on chain or has no game data` },
          { status: 404 }
        );
      }
      return NextResponse.json(game);
    }

    const games = await listGamesFromChain();
    return NextResponse.json({ games, count: games.length });
  } catch (error: any) {
    console.error('[chain/games] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch on-chain games' },
      { status: 500 }
    );
  }
}
