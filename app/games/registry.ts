import type { GameConfig } from './types';
import { chessConfig } from './chess/config';

const GAME_REGISTRY: Record<string, GameConfig> = {
  chess: chessConfig,
};

export function getGameConfig(type: string): GameConfig {
  const config = GAME_REGISTRY[type];
  if (!config) throw new Error(`Unknown game type: ${type}`);
  return config;
}

export function getAllGameTypes(): GameConfig[] {
  return Object.values(GAME_REGISTRY);
}

export function isValidGameType(type: string): boolean {
  return type in GAME_REGISTRY;
}

export function registerGame(config: GameConfig): void {
  GAME_REGISTRY[config.type] = config;
}
