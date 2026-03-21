# Board Color Themes — Design Spec

## Goal

Add 10 selectable board color themes (including 4 Verus-branded variants) with an optional Verus logo watermark. The challenger picks the theme in a challenge popup; it applies to both players and is stored with the game.

## Themes

| ID | Name | Light Square | Dark Square |
|----|------|-------------|-------------|
| `classic` | Classic | `#ebecd0` | `#606956` |
| `blue-white` | Blue & White | `#dee8f0` | `#4a7fb5` |
| `walnut` | Walnut | `#f0d9b5` | `#b58863` |
| `emerald` | Emerald | `#ffffdd` | `#86a666` |
| `midnight` | Midnight | `#c8c8c8` | `#2d2d2d` |
| `royal` | Royal Purple | `#e8d5f5` | `#7b4fa0` |
| `verus-bright` | Verus Bright | `#E8EDF5` | `#3165D4` |
| `verus-steel` | Verus Steel | `#D6D6D6` | `#3165D4` |
| `verus-deep` | Verus Deep | `#C8D6F0` | `#254BA0` |
| `verus-dark` | Verus Dark | `#959595` | `#1C1C1C` |

Default theme: `classic` (preserves current behavior).

## Verus Logo Watermark

A Verus icon overlay centered on the board. Three modes controlled by a `logoMode` setting:

- **off** — no logo (default)
- **faded** — ~10% opacity, covers center 2x2 squares, `pointer-events: none`
- **centered** — ~40% opacity, same position

Available on all 10 themes, not just Verus variants.

Logo asset: `verus-icon-white.svg` from [VerusCoin/Media-Assets](https://github.com/VerusCoin/Media-Assets), saved to `public/img/verus-icon-white.svg`. On light-square themes the white logo may be subtle — this is acceptable as a watermark. For better cross-theme visibility, apply a subtle `drop-shadow` filter to the logo element.

## Architecture

### Approach: Theme config object + CSS variables

Each theme is a plain object in `app/utils/board-themes.ts`. The Chessboard component receives the theme ID as a prop, looks it up, and sets CSS custom properties (`--square-light`, `--square-dark`) on the board container. The CSS uses these variables instead of hardcoded colors.

### Theme Config (`app/utils/board-themes.ts`)

```ts
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

export function getTheme(id: string): BoardTheme {
  return BOARD_THEMES.find(t => t.id === id) || BOARD_THEMES[0];
}
```

### Database Changes (`prisma/schema.prisma`)

Add two columns to the `Game` model:

```prisma
boardTheme   String  @default("classic")
logoMode     String  @default("off")
```

### Chessboard Component Changes

**Props** — add `boardTheme` and `logoMode`:

```ts
interface Props {
  playMove: (piece: Piece, position: Position) => boolean;
  pieces: Piece[];
  bottomColor?: 'white' | 'black';
  boardTheme?: string;
  logoMode?: LogoMode;
}
```

**Rendering**:
- Look up theme by ID from `BOARD_THEMES`
- Set `--square-light` and `--square-dark` as inline style CSS variables on the board container div
- Replace hardcoded `.black-tile` / `.white-tile` background colors in `Chessboard.css` with `var(--square-light)` / `var(--square-dark)`
- The `.valid-move` and `.attack-move` CSS rules must use overlays (e.g., `box-shadow: inset`) rather than replacing `background-color`, so theme colors show through
- Add a positioned `<img>` overlay for the Verus logo, centered on the board, controlled by `logoMode`
- Logo sizing: `2 * GRID_SIZE` (200px) wide/tall, positioned absolutely at `left: 3 * GRID_SIZE; top: 3 * GRID_SIZE` within the board container, `pointer-events: none`

### Challenge Popup (`components/chessboard/ChallengeModal.tsx`)

New modal component replacing the inline mode dropdown on the users page.

**Trigger**: Click "Challenge" on a user → `ChallengeModal` opens.

**Contents**:
1. **Mode picker** — Normal / Showcase buttons
2. **Logo toggle** — Off / Faded / Centered (three-way toggle)
3. **Theme grid** — 10 mini board previews in a grid, click to select. Previews update live to reflect current logo toggle state.
4. **Confirm button** — "Send Challenge" sends the challenge with all settings

**Props**:
```ts
interface ChallengeModalProps {
  targetUser: { id: string; displayName: string; verusId: string };
  onConfirm: (settings: { mode: string; boardTheme: string; logoMode: LogoMode }) => void;
  onClose: () => void;
}
```

## Data Flow

```
Challenger clicks "Challenge"
  → ChallengeModal opens
  → Picks mode + logo toggle + theme
  → "Send Challenge" emits challenge-user { userId, mode, boardTheme, logoMode }
  → server.js relays new-challenge to opponent with all fields
  → Opponent accepts → POST /api/game { whitePlayerId, blackPlayerId, mode, boardTheme, logoMode }
  → Game created in DB with boardTheme + logoMode columns
  → Both players load /game/[gameId]
  → GameClient reads game.boardTheme + game.logoMode from API response
  → Passes to Chessboard component as props
  → Board renders with theme colors + logo overlay
```

**Rematch**: `server.js` reads `boardTheme` and `logoMode` from the original game, adds them to `newGameData` alongside `mode` (same carry-over pattern).

**Challenge accept flow**: The `incomingChallenge` state in `users/page.tsx` must include `boardTheme` and `logoMode`. The incoming challenge popup should display the theme name. The `handleAcceptChallenge` handler must forward both fields to `POST /api/game`.

**Validation**: `POST /api/game` validates `boardTheme` against known theme IDs and `logoMode` against `['off', 'faded', 'centered']`. Defaults to `classic` / `off` if missing or invalid.

**Migration**: After schema change, run `npx prisma db push && npx prisma generate`. Existing games get default values automatically via Prisma's `@default`.

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `app/utils/board-themes.ts` | Theme definitions, types, `getTheme()` |
| Create | `components/chessboard/ChallengeModal.tsx` | Challenge config popup |
| Create | `public/img/verus-icon-white.svg` | Verus logo asset |
| Modify | `prisma/schema.prisma` | Add `boardTheme`, `logoMode` to Game model |
| Modify | `components/chessboard/Chessboard.tsx` | Accept theme/logo props, set CSS vars, render logo overlay |
| Modify | `components/chessboard/Chessboard.css` | Replace hardcoded colors with CSS variables |
| Modify | `app/game/[gameId]/GameClient.tsx` | Read theme from game data, pass to Chessboard |
| Modify | `app/users/page.tsx` | Replace inline dropdown with ChallengeModal |
| Modify | `app/api/game/route.ts` | Accept + store `boardTheme`, `logoMode` |
| Modify | `server.js` | Add `boardTheme`, `logoMode` to `challenge-user` destructure, `new-challenge` emit, and `rematch-accept` `newGameData` |

## Out of Scope

- **VDXF key for on-chain theme storage** — noted for future. Could be a single combined key like `classic:faded`.
- **3D chess board** — separate project, to be brainstormed independently.
- **Per-user theme preference** — theme is per-game, set by challenger.
- **Games list theme badge** — low priority, can add later.
