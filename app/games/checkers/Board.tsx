'use client';

import './Board.css';
import { useState, useEffect, useCallback } from 'react';
import { getTheme, LogoMode } from '@/app/utils/board-themes';
import type { BoardProps } from '../types';
import type { CheckerPiece } from './models/CheckerPiece';
import { clonePiece } from './models/CheckerPiece';
import { PieceType, Team } from './types';
import { BOARD_SIZE, GRID_SIZE } from './constants';
import {
  CheckersState,
  getValidMoves,
  getJumpMoves,
  getContinuationJumps,
  teamHasJump,
  applyMoveToState,
  buildMoveString,
  getGameStatus,
  MoveTarget,
} from './rules';

interface CheckersBoardProps extends BoardProps {
  boardTheme?: string;
  logoMode?: string;
}

export default function CheckersBoard({
  boardState,
  currentPlayer,
  onMove,
  boardTheme = 'classic',
  logoMode = 'off',
  disabled = false,
}: CheckersBoardProps) {
  const state = boardState as unknown as CheckersState;
  const theme = getTheme(boardTheme);
  const gameStatus = getGameStatus(state);

  // -- Internal selection state --
  const [selectedPiece, setSelectedPiece] = useState<CheckerPiece | null>(null);
  const [validTargets, setValidTargets] = useState<MoveTarget[]>([]);

  // Multi-jump tracking
  const [jumpChain, setJumpChain] = useState<{ row: number; col: number }[]>([]);
  const [midJumpPieces, setMidJumpPieces] = useState<CheckerPiece[]>([]);
  const [midJumpPiece, setMidJumpPiece] = useState<CheckerPiece | null>(null);

  // Reset selection when boardState or currentPlayer changes (opponent moved)
  useEffect(() => {
    setSelectedPiece(null);
    setValidTargets([]);
    setJumpChain([]);
    setMidJumpPieces([]);
    setMidJumpPiece(null);
  }, [boardState, currentPlayer]);

  const currentTeam = currentPlayer === 1 ? Team.RED : Team.BLACK;
  const isMyTurn = state.currentTeam === currentTeam;
  const canInteract = !disabled && isMyTurn && !gameStatus.isOver;

  // The "live" pieces for rendering: during a mid-jump chain, we show captured
  // pieces already removed.
  const livePieces: CheckerPiece[] = midJumpPiece
    ? midJumpPieces
    : state.pieces;

  // -----------------------------------------------------------------------
  // Piece click
  // -----------------------------------------------------------------------
  const handlePieceClick = useCallback((piece: CheckerPiece) => {
    if (!canInteract) return;
    if (piece.team !== currentTeam) return;

    // If we're mid-jump, can't select a different piece
    if (midJumpPiece) return;

    if (selectedPiece && selectedPiece.row === piece.row && selectedPiece.col === piece.col) {
      // Deselect
      setSelectedPiece(null);
      setValidTargets([]);
      return;
    }

    const moves = getValidMoves(piece, livePieces);
    if (moves.length === 0) return; // piece has no moves

    setSelectedPiece(piece);
    setValidTargets(moves);
  }, [canInteract, currentTeam, selectedPiece, livePieces, midJumpPiece]);

  // -----------------------------------------------------------------------
  // Tile click — execute a move
  // -----------------------------------------------------------------------
  const handleTileClick = useCallback((row: number, col: number) => {
    if (!canInteract) return;

    // If no piece selected, check if a piece is at this tile and select it
    if (!selectedPiece && !midJumpPiece) {
      const piece = livePieces.find(p => p.row === row && p.col === col);
      if (piece && piece.team === currentTeam) {
        handlePieceClick(piece);
      }
      return;
    }

    // Check if this is a valid target
    const target = validTargets.find(t => t.row === row && t.col === col);
    if (!target) {
      // Clicked somewhere invalid. If not mid-jump, deselect.
      if (!midJumpPiece) {
        // Maybe clicked a different own piece
        const piece = livePieces.find(p => p.row === row && p.col === col);
        if (piece && piece.team === currentTeam) {
          handlePieceClick(piece);
        } else {
          setSelectedPiece(null);
          setValidTargets([]);
        }
      }
      return;
    }

    const activePiece = midJumpPiece || selectedPiece!;

    // Is this a jump?
    const isJump = Math.abs(target.row - activePiece.row) === 2;

    if (!isJump) {
      // Simple move — complete immediately
      const steps = [
        { row: activePiece.row, col: activePiece.col },
        { row: target.row, col: target.col },
      ];
      const moveStr = buildMoveString(steps);
      const newState = applyMoveToState(state, moveStr, currentPlayer);

      setSelectedPiece(null);
      setValidTargets([]);
      onMove(moveStr, newState as unknown as Record<string, unknown>);
      return;
    }

    // Jump — check for multi-jump
    const chain = jumpChain.length > 0
      ? jumpChain
      : [{ row: activePiece.row, col: activePiece.col }];
    const newChain = [...chain, { row: target.row, col: target.col }];

    // Remove captured piece from the live set
    const midR = activePiece.row + (target.row - activePiece.row) / 2;
    const midC = activePiece.col + (target.col - activePiece.col) / 2;
    let nextPieces = (midJumpPiece ? midJumpPieces : state.pieces).map(clonePiece);

    // Remove the jumped piece
    nextPieces = nextPieces.filter(p => !(p.row === midR && p.col === midC));

    // Move the active piece
    const movedPiece = nextPieces.find(p => p.row === activePiece.row && p.col === activePiece.col);
    if (!movedPiece) return;
    movedPiece.row = target.row;
    movedPiece.col = target.col;

    // Check if piece gets kinged (stops the chain)
    const getsKinged =
      movedPiece.type === PieceType.REGULAR &&
      ((movedPiece.team === Team.RED && movedPiece.row === BOARD_SIZE - 1) ||
       (movedPiece.team === Team.BLACK && movedPiece.row === 0));

    if (getsKinged) {
      movedPiece.type = PieceType.KING;
    }

    // Check for continuation jumps
    const contJumps = getsKinged ? [] : getContinuationJumps(movedPiece, nextPieces);

    if (contJumps.length > 0) {
      // Multi-jump continues — update mid-jump state
      setJumpChain(newChain);
      setMidJumpPieces(nextPieces);
      setMidJumpPiece(movedPiece);
      setSelectedPiece(movedPiece);
      setValidTargets(contJumps);
      return;
    }

    // Jump chain complete — commit the full move
    const moveStr = buildMoveString(newChain);
    // Use the original start from newChain[0] to apply the full move
    const newState = applyMoveToState(state, moveStr, currentPlayer);

    setSelectedPiece(null);
    setValidTargets([]);
    setJumpChain([]);
    setMidJumpPieces([]);
    setMidJumpPiece(null);
    onMove(moveStr, newState as unknown as Record<string, unknown>);
  }, [
    canInteract, selectedPiece, midJumpPiece, validTargets,
    jumpChain, midJumpPieces, livePieces, currentTeam,
    currentPlayer, state, onMove, handlePieceClick,
  ]);

  // -----------------------------------------------------------------------
  // Determine which pieces are selectable (has valid moves and it's their turn)
  // -----------------------------------------------------------------------
  const selectablePieceKeys = new Set<string>();
  if (canInteract && !midJumpPiece) {
    const hasJump = teamHasJump(livePieces, currentTeam);
    for (const p of livePieces) {
      if (p.team !== currentTeam) continue;
      if (hasJump) {
        if (getJumpMoves(p, livePieces).length > 0) {
          selectablePieceKeys.add(`${p.row},${p.col}`);
        }
      } else {
        if (getValidMoves(p, livePieces).length > 0) {
          selectablePieceKeys.add(`${p.row},${p.col}`);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const tiles: React.ReactNode[] = [];

  // Flip board: Player 1 (Red) sees red at bottom, Player 2 (Black) sees black at bottom
  const flipBoard = currentPlayer === 1;

  for (let displayRow = 0; displayRow < BOARD_SIZE; displayRow++) {
    for (let displayCol = 0; displayCol < BOARD_SIZE; displayCol++) {
      const row = flipBoard ? (BOARD_SIZE - 1 - displayRow) : displayRow;
      const col = flipBoard ? (BOARD_SIZE - 1 - displayCol) : displayCol;
      const isDark = (row + col) % 2 === 1;
      const piece = livePieces.find(p => p.row === row && p.col === col);
      const isTarget = validTargets.some(t => t.row === row && t.col === col);
      const isJumpTarget = isTarget && selectedPiece && Math.abs(row - (midJumpPiece || selectedPiece).row) === 2;
      const isSelected = selectedPiece && selectedPiece.row === row && selectedPiece.col === col;

      const pieceSize = GRID_SIZE * 0.78;
      const pieceOffset = (GRID_SIZE - pieceSize) / 2;

      tiles.push(
        <div
          key={`${row}-${col}`}
          className={`tile ${isDark ? 'dark-tile' : 'light-tile'} ${isTarget ? 'tile-valid-move' : ''}`}
          style={{ width: GRID_SIZE, height: GRID_SIZE, position: 'relative' }}
          onClick={() => handleTileClick(row, col)}
        >
          {/* Piece */}
          {piece && (
            <div
              className={[
                'checker-piece',
                piece.team === Team.RED ? 'team-red' : 'team-black',
                isSelected ? 'selected' : '',
                selectablePieceKeys.has(`${row},${col}`) ? 'selectable' : '',
              ].join(' ')}
              style={{
                width: pieceSize,
                height: pieceSize,
                top: pieceOffset,
                left: pieceOffset,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (piece.team === currentTeam) {
                  handlePieceClick(piece);
                } else {
                  handleTileClick(row, col);
                }
              }}
            >
              {piece.type === PieceType.KING && (
                <span className="king-crown">&#9733;</span>
              )}
            </div>
          )}

          {/* Move indicator — empty square */}
          {isTarget && !piece && !isJumpTarget && (
            <div className="checker-move-indicator" />
          )}

          {/* Jump target indicator */}
          {isJumpTarget && !piece && (
            <div className="checker-jump-indicator" />
          )}
        </div>
      );
    }
  }

  return (
    <div>
      <div
        id="checkerboard"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
          width: GRID_SIZE * BOARD_SIZE,
          height: GRID_SIZE * BOARD_SIZE,
          '--square-light': theme.lightSquare,
          '--square-dark': theme.darkSquare,
          position: 'relative',
        } as React.CSSProperties}
      >
        {tiles}

        {/* Verus logo overlay */}
        {logoMode !== 'off' && (
          <img
            src="/img/verus-icon-white.svg"
            alt=""
            style={{
              position: 'absolute',
              top: GRID_SIZE * 3,
              left: GRID_SIZE * 3,
              width: GRID_SIZE * 2,
              height: GRID_SIZE * 2,
              opacity: logoMode === 'faded' ? 0.2 : 0.55,
              pointerEvents: 'none',
              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))',
              zIndex: 1,
            }}
          />
        )}

        {/* Game over overlay */}
        {gameStatus.isOver && (
          <div className="checkers-game-over">
            <div className="checkers-game-over-text">
              {gameStatus.resultDisplay}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
