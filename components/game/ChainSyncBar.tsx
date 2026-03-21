'use client';

interface ChainSyncBarProps {
  sentMoves: number;
  confirmedMoves: number;
  totalMoves: number;
  mode: string;
}

export default function ChainSyncBar({ sentMoves, confirmedMoves, totalMoves, mode }: ChainSyncBarProps) {
  if (mode !== 'showcase' || totalMoves === 0) return null;

  const allConfirmed = confirmedMoves >= totalMoves;
  const allSent = sentMoves >= totalMoves;
  const unsent = totalMoves - sentMoves;

  const parts: JSX.Element[] = [];

  if (confirmedMoves > 0) {
    parts.push(<span key="confirmed" className="text-green-400">{confirmedMoves} confirmed</span>);
  }
  if (sentMoves > confirmedMoves) {
    parts.push(<span key="sent" className="text-yellow-400">{sentMoves - confirmedMoves} in mempool</span>);
  }
  if (unsent > 0) {
    parts.push(<span key="unsent" className="text-red-400/60">{unsent} pending</span>);
  }

  const statusDot = allConfirmed
    ? 'bg-green-400'
    : allSent
      ? 'bg-yellow-400 animate-pulse'
      : 'bg-red-400/60 animate-pulse';

  return (
    <div className="px-3 py-2 text-xs border-t border-border bg-muted/50">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${statusDot}`} />
        {allConfirmed ? (
          <span className="text-green-400">All {totalMoves} moves confirmed on chain</span>
        ) : (
          <span className="flex items-center gap-1">
            {parts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">·</span>}
                {part}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
