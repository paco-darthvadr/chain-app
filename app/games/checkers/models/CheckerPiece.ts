import { PieceType, Team } from '../types';

export interface CheckerPiece {
  row: number;
  col: number;
  team: Team;
  type: PieceType;
}

export function createPiece(row: number, col: number, team: Team, type: PieceType = PieceType.REGULAR): CheckerPiece {
  return { row, col, team, type };
}

export function clonePiece(piece: CheckerPiece): CheckerPiece {
  return { ...piece };
}
