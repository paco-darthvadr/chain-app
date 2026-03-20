'use client';

import type { SidebarProps } from '../types';
import type { CheckersState } from './rules';
import { Team } from './types';

export default function CheckersSidebar({ boardState, moves, currentPlayer }: SidebarProps) {
  const state = boardState as unknown as CheckersState;
  const capturedRed = state.capturedRed || 0;
  const capturedBlack = state.capturedBlack || 0;

  const redPieces = state.pieces?.filter(p => p.team === Team.RED).length ?? 12;
  const blackPieces = state.pieces?.filter(p => p.team === Team.BLACK).length ?? 12;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      {/* Score summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Score</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-600 border border-red-800" />
            <span className="text-sm font-medium">Red</span>
          </div>
          <span className="text-sm">
            {redPieces} remaining &middot; {capturedBlack} captured
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-800 border border-gray-900 dark:bg-gray-700 dark:border-gray-600" />
            <span className="text-sm font-medium">Black</span>
          </div>
          <span className="text-sm">
            {blackPieces} remaining &middot; {capturedRed} captured
          </span>
        </div>
      </div>

      {/* Turn indicator */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Turn</h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${currentPlayer === 1 ? 'bg-red-600' : 'bg-gray-800 dark:bg-gray-700'}`} />
          <span className="text-sm font-medium">{currentPlayer === 1 ? 'Red' : 'Black'} to move</span>
        </div>
      </div>

      {/* Move list */}
      <div className="space-y-1 flex-1 min-h-0">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Moves</h3>
        <div className="overflow-y-auto max-h-64 space-y-0.5">
          {moves.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No moves yet</p>
          ) : (
            moves.map((move, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono py-0.5">
                <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                <div className={`w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-red-600' : 'bg-gray-800 dark:bg-gray-700'}`} />
                <span>{move}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
