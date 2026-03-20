import { Board } from "./models/Board";
import { Pawn } from "./models/Pawn";
import { Piece } from "./models/Piece";
import { Position } from "./models/Position";
import { PieceType, TeamType } from "./types";

export const VERTICAL_AXIS = ["1", "2", "3", "4", "5", "6", "7", "8"];
export const HORIZONTAL_AXIS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const GRID_SIZE = 100;

export const initialBoard: Board = new Board([
  new Piece(
  new Position(0, 7), 
  PieceType.ROOK, 
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(1, 7),
  PieceType.KNIGHT,
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(2, 7),
  PieceType.BISHOP,
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(3, 7),
  PieceType.QUEEN,
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(4, 7),
  PieceType.KING,
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(5, 7),
  PieceType.BISHOP,
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(6, 7),
  PieceType.KNIGHT,
  TeamType.OPPONENT,
  false),
  new Piece(
  new Position(7, 7),
  PieceType.ROOK,
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(0, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(1, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(2, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(3, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(4, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(5, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(6, 6),
  TeamType.OPPONENT,
  false),
  new Pawn(
  new Position(7, 6),
  TeamType.OPPONENT,
  false),

  new Piece( 
  new Position(0, 0), 
  PieceType.ROOK, 
  TeamType.OUR,
  false),
  new Piece(
  new Position(1, 0),
  PieceType.KNIGHT,
  TeamType.OUR,
  false),
  new Piece(
  new Position(2, 0),
  PieceType.BISHOP,
  TeamType.OUR,
  false),
  new Piece(
  new Position(3, 0),
  PieceType.QUEEN,
  TeamType.OUR,
  false),
  new Piece(
  new Position(4, 0),
  PieceType.KING,
  TeamType.OUR,
  false),
  new Piece(
  new Position(5, 0),
  PieceType.BISHOP,
  TeamType.OUR,
  false),
  new Piece(
  new Position(6, 0),
  PieceType.KNIGHT,
  TeamType.OUR,
  false),
  new Piece(
  new Position(7, 0),
  PieceType.ROOK,
  TeamType.OUR,
  false),
  new Pawn(
  new Position(0, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(1, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(2, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(3, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(4, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(5, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(6, 1),
  TeamType.OUR,
  false),
  new Pawn(
  new Position(7, 1),
  TeamType.OUR,
  false),
], 1);

export const initialPieces = [
  { "position": { "x": 0, "y": 7 }, "type": "rook", "team": "b", "hasMoved": false },
  { "position": { "x": 1, "y": 7 }, "type": "knight", "team": "b", "hasMoved": false },
  { "position": { "x": 2, "y": 7 }, "type": "bishop", "team": "b", "hasMoved": false },
  { "position": { "x": 3, "y": 7 }, "type": "queen", "team": "b", "hasMoved": false },
  { "position": { "x": 4, "y": 7 }, "type": "king", "team": "b", "hasMoved": false },
  { "position": { "x": 5, "y": 7 }, "type": "bishop", "team": "b", "hasMoved": false },
  { "position": { "x": 6, "y": 7 }, "type": "knight", "team": "b", "hasMoved": false },
  { "position": { "x": 7, "y": 7 }, "type": "rook", "team": "b", "hasMoved": false },
  { "position": { "x": 0, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 1, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 2, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 3, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 4, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 5, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 6, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 7, "y": 6 }, "type": "pawn", "team": "b", "hasMoved": false },
  { "position": { "x": 0, "y": 0 }, "type": "rook", "team": "w", "hasMoved": false },
  { "position": { "x": 1, "y": 0 }, "type": "knight", "team": "w", "hasMoved": false },
  { "position": { "x": 2, "y": 0 }, "type": "bishop", "team": "w", "hasMoved": false },
  { "position": { "x": 3, "y": 0 }, "type": "queen", "team": "w", "hasMoved": false },
  { "position": { "x": 4, "y": 0 }, "type": "king", "team": "w", "hasMoved": false },
  { "position": { "x": 5, "y": 0 }, "type": "bishop", "team": "w", "hasMoved": false },
  { "position": { "x": 6, "y": 0 }, "type": "knight", "team": "w", "hasMoved": false },
  { "position": { "x": 7, "y": 0 }, "type": "rook", "team": "w", "hasMoved": false },
  { "position": { "x": 0, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 1, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 2, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 3, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 4, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 5, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 6, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false },
  { "position": { "x": 7, "y": 1 }, "type": "pawn", "team": "w", "hasMoved": false }
];