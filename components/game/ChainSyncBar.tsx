'use client';

interface ChainSyncBarProps {
  syncedMoves: number;
  totalMoves: number;
  mode: string;
}

export default function ChainSyncBar({ syncedMoves, totalMoves, mode }: ChainSyncBarProps) {
  if (mode !== 'showcase' || totalMoves === 0) return null;

  const allSynced = syncedMoves >= totalMoves;
  const pendingStart = syncedMoves + 1;
  const pendingEnd = totalMoves;

  return (
    <div className="px-3 py-2 text-xs border-t border-border bg-muted/50">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${allSynced ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
        {allSynced ? (
          <span className="text-green-400">All {totalMoves} moves on chain</span>
        ) : syncedMoves === 0 ? (
          <span className="text-yellow-400">{totalMoves} move{totalMoves > 1 ? 's' : ''} pending chain sync</span>
        ) : (
          <span>
            <span className="text-green-400">Moves 1–{syncedMoves} on chain</span>
            <span className="text-muted-foreground"> | </span>
            <span className="text-yellow-400">{pendingStart}–{pendingEnd} pending</span>
          </span>
        )}
      </div>
    </div>
  );
}
