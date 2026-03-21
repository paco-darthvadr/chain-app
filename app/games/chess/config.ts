import { lazy } from 'react';
import type { GameConfig, VDXFKeySet } from '../types';
import { CHESS_VDXF_KEYS } from './vdxf-keys';
import { initialPieces } from './constants';

// Map chess-specific VDXF key names to generic slots
const vdxfKeys: VDXFKeySet = {
  version:        CHESS_VDXF_KEYS.version,
  player1:        CHESS_VDXF_KEYS.white,
  player2:        CHESS_VDXF_KEYS.black,
  winner:         CHESS_VDXF_KEYS.winner,
  result:         CHESS_VDXF_KEYS.result,
  moves:          CHESS_VDXF_KEYS.moves,
  movecount:      CHESS_VDXF_KEYS.movecount,
  duration:       CHESS_VDXF_KEYS.duration,
  startedat:      CHESS_VDXF_KEYS.startedat,
  gamehash:       CHESS_VDXF_KEYS.gamehash,
  player1sig:     CHESS_VDXF_KEYS.whitesig,
  player2sig:     CHESS_VDXF_KEYS.blacksig,
  mode:           CHESS_VDXF_KEYS.mode,
  movesigs:       CHESS_VDXF_KEYS.movesigs,
  player1opensig: CHESS_VDXF_KEYS.whiteopensig,
  player2opensig: CHESS_VDXF_KEYS.blackopensig,
  status:         CHESS_VDXF_KEYS.status,
};

export const chessConfig: GameConfig = {
  type: 'chess',
  displayName: 'Chess',
  description: 'Classic chess — checkmate your opponent',
  icon: '♟️',

  player1Label: 'White',
  player2Label: 'Black',

  boardSize: 8,
  themeMode: 'grid',

  parentIdentityName: process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@',
  parentIdentityAddress: process.env.CHESSGAME_IDENTITY_ADDRESS || '',
  signingWif: process.env.CHESSGAME_SIGNING_WIF || '',
  vdxfKeys,
  chainEnabled: true,
  subIdPrefix: 'game',

  BoardComponent: lazy(() => import('./Board')) as any,
  SidebarComponent: undefined,

  createInitialState: () => ({
    pieces: initialPieces,
    totalTurns: 0,
    currentTeam: 'w',
    winningTeam: null,
    capturedPieces: [],
  }),

  validateMove: () => true,
  applyMove: (state) => state,
  getGameStatus: (state: any) => ({
    isOver: !!state.winningTeam,
    winner: state.winningTeam === 'w' ? 1 : state.winningTeam === 'b' ? 2 : null,
    result: state.winningTeam ? 'checkmate' : 'in-progress',
    resultDisplay: state.winningTeam ? 'Checkmate!' : '',
  }),

  formatMoveForDisplay: (move: string) => move,
};
