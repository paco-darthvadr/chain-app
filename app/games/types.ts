import { ComponentType, LazyExoticComponent } from 'react';

export interface VDXFKey {
  uri: string;
  vdxfid: string;
}

export interface VDXFKeySet {
  version: VDXFKey;
  player1: VDXFKey;
  player2: VDXFKey;
  winner: VDXFKey;
  result: VDXFKey;
  moves: VDXFKey;
  movecount: VDXFKey;
  duration: VDXFKey;
  startedat: VDXFKey;
  gamehash: VDXFKey;
  player1sig: VDXFKey;
  player2sig: VDXFKey;
  mode: VDXFKey;
  movesigs: VDXFKey;
  player1opensig: VDXFKey;
  player2opensig: VDXFKey;
  status: VDXFKey;
}

export type BoardState = Record<string, unknown>;

export interface GameStatus {
  isOver: boolean;
  winner: 1 | 2 | null;
  result: string;
  resultDisplay: string;
}

export interface BoardProps {
  boardState: BoardState;
  currentPlayer: 1 | 2;
  onMove: (move: string, newBoardState: BoardState) => void;
  boardTheme?: string;
  logoMode?: string;
  isSpectator?: boolean;
  disabled?: boolean;
}

export interface SidebarProps {
  boardState: BoardState;
  moves: string[];
  currentPlayer: 1 | 2;
  chainSentMoves?: number;
  chainConfirmedMoves?: number;
  mode?: string;
}

export interface GameConfig {
  type: string;
  displayName: string;
  description: string;
  icon: string;

  player1Label: string;
  player2Label: string;

  boardSize: number;
  themeMode: 'grid' | 'custom';

  parentIdentityName: string;
  parentIdentityAddress: string;
  signingWif: string;
  vdxfKeys: VDXFKeySet;
  chainEnabled: boolean;
  subIdPrefix: string;

  BoardComponent: LazyExoticComponent<ComponentType<BoardProps>>;
  SidebarComponent?: LazyExoticComponent<ComponentType<SidebarProps>>;

  createInitialState: () => BoardState;
  validateMove: (state: BoardState, move: string, player: 1 | 2) => boolean;
  applyMove: (state: BoardState, move: string, player: 1 | 2) => BoardState;
  getGameStatus: (state: BoardState) => GameStatus;

  formatMoveForDisplay: (move: string, moveNum: number) => string;
}
