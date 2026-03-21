import { lazy } from 'react';
import type { GameConfig, VDXFKeySet } from '../types';
import { CHECKERS_VDXF_KEYS } from './vdxf-keys';
import { createInitialPieces } from './constants';
import { Team } from './types';
import {
  CheckersState,
  validateMove,
  applyMoveToState,
  getGameStatus,
} from './rules';

// Map checkers-specific VDXF key names to generic slots
const vdxfKeys: VDXFKeySet = {
  version:        CHECKERS_VDXF_KEYS.version,
  player1:        CHECKERS_VDXF_KEYS.red,
  player2:        CHECKERS_VDXF_KEYS.black,
  winner:         CHECKERS_VDXF_KEYS.winner,
  result:         CHECKERS_VDXF_KEYS.result,
  moves:          CHECKERS_VDXF_KEYS.moves,
  movecount:      CHECKERS_VDXF_KEYS.movecount,
  duration:       CHECKERS_VDXF_KEYS.duration,
  startedat:      CHECKERS_VDXF_KEYS.startedat,
  gamehash:       CHECKERS_VDXF_KEYS.gamehash,
  player1sig:     CHECKERS_VDXF_KEYS.redsig,
  player2sig:     CHECKERS_VDXF_KEYS.blacksig,
  mode:           CHECKERS_VDXF_KEYS.mode,
  movesigs:       CHECKERS_VDXF_KEYS.movesigs,
  player1opensig: CHECKERS_VDXF_KEYS.redopensig,
  player2opensig: CHECKERS_VDXF_KEYS.blackopensig,
  status:         CHECKERS_VDXF_KEYS.status,
};

export const checkersConfig: GameConfig = {
  type: 'checkers',
  displayName: 'Checkers',
  description: 'Classic checkers — capture all opponent pieces',
  icon: '\u{1F3C1}',

  player1Label: 'Red',
  player2Label: 'Black',

  boardSize: 8,
  themeMode: 'grid',

  parentIdentityName: process.env.CHECKERSGAME_IDENTITY_NAME || 'CheckersGame@',
  parentIdentityAddress: process.env.CHECKERSGAME_IDENTITY_ADDRESS || '',
  signingWif: process.env.CHECKERSGAME_SIGNING_WIF || '',
  vdxfKeys,
  chainEnabled: true,
  subIdPrefix: 'game',

  BoardComponent: lazy(() => import('./Board')),
  SidebarComponent: lazy(() => import('./Sidebar')),

  createInitialState: () => {
    const initial: CheckersState = {
      pieces: createInitialPieces(),
      currentTeam: Team.RED,
      capturedRed: 0,
      capturedBlack: 0,
    };
    return initial as unknown as Record<string, unknown>;
  },

  validateMove: (state, move, player) => {
    return validateMove(state as unknown as CheckersState, move, player);
  },

  applyMove: (state, move, player) => {
    return applyMoveToState(
      state as unknown as CheckersState,
      move,
      player,
    ) as unknown as Record<string, unknown>;
  },

  getGameStatus: (state) => {
    return getGameStatus(state as unknown as CheckersState);
  },

  formatMoveForDisplay: (move: string, moveNum: number) => {
    return `${moveNum}. ${move}`;
  },
};
