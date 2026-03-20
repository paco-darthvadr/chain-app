export interface BoardTheme {
  id: string;
  name: string;
  lightSquare: string;
  darkSquare: string;
}

export type LogoMode = 'off' | 'faded' | 'centered';

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'classic', name: 'Classic', lightSquare: '#ebecd0', darkSquare: '#606956' },
  { id: 'blue-white', name: 'Blue & White', lightSquare: '#dee8f0', darkSquare: '#4a7fb5' },
  { id: 'walnut', name: 'Walnut', lightSquare: '#f0d9b5', darkSquare: '#b58863' },
  { id: 'emerald', name: 'Emerald', lightSquare: '#ffffdd', darkSquare: '#86a666' },
  { id: 'midnight', name: 'Midnight', lightSquare: '#c8c8c8', darkSquare: '#2d2d2d' },
  { id: 'royal', name: 'Royal Purple', lightSquare: '#e8d5f5', darkSquare: '#7b4fa0' },
  { id: 'verus-bright', name: 'Verus Bright', lightSquare: '#E8EDF5', darkSquare: '#3165D4' },
  { id: 'verus-steel', name: 'Verus Steel', lightSquare: '#D6D6D6', darkSquare: '#3165D4' },
  { id: 'verus-deep', name: 'Verus Deep', lightSquare: '#C8D6F0', darkSquare: '#254BA0' },
  { id: 'verus-dark', name: 'Verus Dark', lightSquare: '#959595', darkSquare: '#1C1C1C' },
];

export const VALID_LOGO_MODES: LogoMode[] = ['off', 'faded', 'centered'];

export function getTheme(id: string): BoardTheme {
  return BOARD_THEMES.find(t => t.id === id) || BOARD_THEMES[0];
}

export function isValidThemeId(id: string): boolean {
  return BOARD_THEMES.some(t => t.id === id);
}

export function isValidLogoMode(mode: string): mode is LogoMode {
  return VALID_LOGO_MODES.includes(mode as LogoMode);
}
