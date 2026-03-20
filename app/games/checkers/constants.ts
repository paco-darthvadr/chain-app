import { CheckerPiece, createPiece } from './models/CheckerPiece';
import { PieceType, Team } from './types';

export const BOARD_SIZE = 8;
export const GRID_SIZE = 100;

/**
 * Create initial checkers layout.
 * Red (player 1) occupies rows 0-2, Black (player 2) occupies rows 5-7.
 * Pieces are placed on dark squares only (where (row + col) is odd).
 */
export function createInitialPieces(): CheckerPiece[] {
  const pieces: CheckerPiece[] = [];

  // Red pieces — rows 0, 1, 2
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        pieces.push(createPiece(row, col, Team.RED, PieceType.REGULAR));
      }
    }
  }

  // Black pieces — rows 5, 6, 7
  for (let row = 5; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        pieces.push(createPiece(row, col, Team.BLACK, PieceType.REGULAR));
      }
    }
  }

  return pieces;
}
