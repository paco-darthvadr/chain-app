# Multi-Game Platform Generalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the chess-specific codebase into a multi-game platform with a pluggable game config registry, then build a playable checkers game on top.

**Architecture:** Every game implements a `GameConfig` interface and registers in a central registry. Shared infrastructure (mode handlers, hash chain, SubID pool, socket server, challenge flow) consumes game configs instead of hardcoded chess references. Chess code moves into `app/games/chess/`, shared UI into `components/game/`. Database renames `whitePlayer`/`blackPlayer` to `player1`/`player2`.

**Tech Stack:** Next.js 14, TypeScript, Prisma/SQLite, Socket.IO, Verus blockchain RPC

**Testing:** This project has no automated test infrastructure. Each task includes manual verification steps — start the dev servers (`node server.js &` and `npx next dev`) and confirm chess still works. The final task verifies checkers end-to-end.

**Spec:** `docs/superpowers/specs/2026-03-20-multi-game-generalization-design.md`

---

### Task 1: Foundation — Game Config Types, Registry, and Data Descriptor

Non-breaking additions. Creates the type system and registry that everything else depends on.

**Files:**
- Create: `app/games/types.ts`
- Create: `app/games/registry.ts`
- Create: `app/utils/data-descriptor.ts`

- [ ] **Step 1: Create `app/games/types.ts`**

All shared interfaces for the game platform:

```typescript
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
```

- [ ] **Step 2: Create `app/games/registry.ts`**

Start with chess only. Checkers added in Task 10.

```typescript
import type { GameConfig } from './types';

// Chess config will be imported here once Task 3 creates it
// import { chessConfig } from './chess/config';

const GAME_REGISTRY: Record<string, GameConfig> = {
  // Populated in Task 3
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
```

- [ ] **Step 3: Create `app/utils/data-descriptor.ts`**

Extract `DD_KEY` and `dd()` from `app/utils/modes/normal/vdxf-keys.ts`. These are Verus infrastructure shared by all games.

```typescript
/** DataDescriptor key i-address (the type marker for DD objects) */
export const DD_KEY = 'i4GC1YGEVD21afWudGoFJVdnfjJ5XWnCQv';

/**
 * Wrap a value as a DataDescriptor for contentmultimap.
 * The daemon auto-decodes these into readable JSON with labels and MIME types.
 */
export function dd(value: string, label: string, mimetype: string = 'text/plain'): object {
  return {
    [DD_KEY]: {
      version: 1,
      mimetype,
      objectdata: { message: value },
      label,
    }
  };
}
```

- [ ] **Step 4: Verify the app still builds**

```bash
npx next build
```

Expected: build succeeds (no existing code changed).

- [ ] **Step 5: Commit**

```bash
git add app/games/types.ts app/games/registry.ts app/utils/data-descriptor.ts
git commit -m "feat: add game config types, registry, and data-descriptor"
```

---

### Task 2: Move Chess Code into `app/games/chess/`

Move chess-specific files into their own directory. This is a mechanical refactoring — move files, update imports. **Do NOT change any logic in this task.** Every import path change is listed explicitly.

**Files:**
- Move: `app/models/*` → `app/games/chess/models/`
- Move: `app/Types.ts` → `app/games/chess/types.ts`
- Move: `app/Constants.ts` → `app/games/chess/constants.ts`
- Move: `app/lib/initialPieces.ts` → `app/games/chess/constants.ts` (merge)
- Move: `app/referee/rules.ts` → `app/games/chess/rules.ts`
- Move: `app/utils/modes/normal/vdxf-keys.ts` → `app/games/chess/vdxf-keys.ts` (VDXF keys only)
- Move: `components/chessboard/Chessboard.tsx` → `app/games/chess/Board.tsx`
- Move: `components/chessboard/Chessboard.css` → `app/games/chess/Board.css`
- Move: `components/chessboard/PromotionDialog.tsx` → `app/games/chess/PromotionDialog.tsx`
- Move: `components/chessboard/MoveHistory.tsx` → `app/games/chess/MoveHistory.tsx`
- Move: `components/chessboard/CapturedPiecesPanel.tsx` → `app/games/chess/CapturedPiecesPanel.tsx`

**Update imports in these files (chess internal):**
- `app/games/chess/Board.tsx`: `@/app/models` → `./models`, `@/app/Constants` → `./constants`, `./Chessboard.css` → `./Board.css`
- `app/games/chess/PromotionDialog.tsx`: `@/app/Types` → `./types`, `@/app/models/Piece` → `./models/Piece`, `@/app/models/Position` → `./models/Position`
- `app/games/chess/CapturedPiecesPanel.tsx`: `@/app/models/Piece` → `./models/Piece`, `@/app/Types` → `./types`
- `app/games/chess/MoveHistory.tsx`: no model/type imports to change (uses prop types only)
- `app/games/chess/models/Board.ts`: `../../referee/rules` → `../rules`, `../../Types` → `../types`
- `app/games/chess/models/Piece.ts`: `../../Types` → `../types`, `../Position` → `./Position`
- `app/games/chess/models/Pawn.ts`: `../../Types` → `../types`, `./Piece` stays, `./Position` stays
- `app/games/chess/models/index.ts`: paths stay relative (already `./`)

**Update imports in consuming files:**
- `app/game/page.tsx` (offline chess page):
  - `@/app/Constants` → `@/app/games/chess/constants`
  - `@/app/models` → `@/app/games/chess/models`
  - `@/app/Types` → `@/app/games/chess/types`
  - `@/components/chessboard/CapturedPiecesPanel` → `@/app/games/chess/CapturedPiecesPanel`
  - `@/components/chessboard/Chessboard` → `@/app/games/chess/Board`
  - `../../../components/chessboard/MoveHistory` → `@/app/games/chess/MoveHistory`
  - `../../../components/chessboard/PromotionDialog` → `@/app/games/chess/PromotionDialog`
  - `../../models/Piece` → `@/app/games/chess/models/Piece`
  - `../../models/Position` → `@/app/games/chess/models/Position`
  - `../../models/Board` → `@/app/games/chess/models/Board`
  - `../../Types` → `@/app/games/chess/types`
  - `../../models/Pawn` → `@/app/games/chess/models/Pawn`
- `app/game/[gameId]/GameClient.tsx`:
  - `../../../components/chessboard/Chessboard` → `@/app/games/chess/Board`
  - `../../../components/chessboard/MoveHistory` → `@/app/games/chess/MoveHistory`
  - `../../../components/chessboard/PromotionDialog` → `@/app/games/chess/PromotionDialog`
  - `../../models/Piece` → `@/app/games/chess/models/Piece`
  - `../../models/Position` → `@/app/games/chess/models/Position`
  - `../../models/Board` → `@/app/games/chess/models/Board`
  - `../../Types` → `@/app/games/chess/types`
  - `@/components/chessboard/CapturedPiecesPanel` → `@/app/games/chess/CapturedPiecesPanel`
  - `../../models/Pawn` → `@/app/games/chess/models/Pawn`
- `app/game/page.tsx`:
  - `@/app/Constants` → `@/app/games/chess/constants`
  - `@/app/models` → `@/app/games/chess/models`
  - `@/app/Types` → `@/app/games/chess/types`
  - `@/components/chessboard/CapturedPiecesPanel` → `@/app/games/chess/CapturedPiecesPanel`
  - `@/components/chessboard/Chessboard` → `@/app/games/chess/Board`
  - (Also update any component JSX name `<Chessboard` → `<Board` if the export name changed, or keep the import alias)
- `app/api/game/route.ts`:
  - `@/app/lib/initialPieces` → `@/app/games/chess/constants` (import `initialPieces`)
- `app/utils/modes/normal/subid-storage.ts`:
  - Dynamic import `'./vdxf-keys'` → `'@/app/games/chess/vdxf-keys'` (temporary — will be parameterized in Task 5)
- `app/utils/chain-reader.ts`:
  - `'./modes/normal/vdxf-keys'` → `'@/app/games/chess/vdxf-keys'` (temporary — parameterized in Task 5)
- `app/utils/modes/showcase/live-storage.ts`:
  - `'../normal/vdxf-keys'` → `'@/app/games/chess/vdxf-keys'` (temporary)

**Update `app/games/chess/vdxf-keys.ts`:** Remove `DD_KEY` and `dd()` exports (they now live in `app/utils/data-descriptor.ts`). Keep only `CHESS_VDXF_KEYS`. Update all files that imported `DD_KEY` or `dd` from vdxf-keys to import from `@/app/utils/data-descriptor` instead:
- `app/utils/modes/normal/subid-storage.ts`: import `{ dd }` from `@/app/utils/data-descriptor`
- `app/utils/chain-reader.ts`: import `{ DD_KEY }` from `@/app/utils/data-descriptor`
- `app/utils/modes/showcase/live-storage.ts`: import `{ dd }` from `@/app/utils/data-descriptor`

- [ ] **Step 1: Create the `app/games/chess/` directory and move model files**

```bash
mkdir -p app/games/chess/models
mv app/models/Piece.ts app/games/chess/models/
mv app/models/Board.ts app/games/chess/models/
mv app/models/Position.ts app/games/chess/models/
mv app/models/Pawn.ts app/games/chess/models/
mv app/models/index.ts app/games/chess/models/
mv app/Types.ts app/games/chess/types.ts
mv app/Constants.ts app/games/chess/constants.ts
mv app/referee/rules.ts app/games/chess/rules.ts
```

- [ ] **Step 2: Move chess VDXF keys (without DD_KEY/dd)**

Copy `app/utils/modes/normal/vdxf-keys.ts` to `app/games/chess/vdxf-keys.ts`. Remove the `DD_KEY` and `dd()` exports from the new file (they're in `data-descriptor.ts` now). Keep the old file temporarily as a re-export shim so nothing breaks until Task 5 parameterizes everything.

- [ ] **Step 3: Move chess UI components**

```bash
mv components/chessboard/Chessboard.tsx app/games/chess/Board.tsx
mv components/chessboard/Chessboard.css app/games/chess/Board.css
mv components/chessboard/PromotionDialog.tsx app/games/chess/PromotionDialog.tsx
mv components/chessboard/MoveHistory.tsx app/games/chess/MoveHistory.tsx
mv components/chessboard/CapturedPiecesPanel.tsx app/games/chess/CapturedPiecesPanel.tsx
```

- [ ] **Step 4: Update all internal imports in moved chess files**

Update every import path listed above in the "Update imports in chess internal files" section. This is mechanical — find/replace old paths with new relative paths.

- [ ] **Step 5: Update all consuming file imports**

Update every import path listed in the "Update imports in consuming files" section. Each file is listed with exact old → new paths.

- [ ] **Step 6: Update DD_KEY/dd imports**

In `subid-storage.ts`, `chain-reader.ts`, and `live-storage.ts`: change `DD_KEY` and `dd` imports to come from `@/app/utils/data-descriptor`.

- [ ] **Step 7: Merge `initialPieces` into chess constants**

Move the content of `app/lib/initialPieces.ts` into `app/games/chess/constants.ts` as an additional export. Update `app/api/game/route.ts` to import from the new location.

- [ ] **Step 8: Verify build**

```bash
npx next build
```

Expected: builds with no errors. All imports resolve.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move chess code into app/games/chess/"
```

---

### Task 3: Chess Game Config

Create the chess `GameConfig` implementation and register it. This wires the existing chess code into the new registry without changing any logic.

**Files:**
- Create: `app/games/chess/config.ts`
- Modify: `app/games/registry.ts`

- [ ] **Step 1: Create `app/games/chess/config.ts`**

```typescript
import { lazy } from 'react';
import type { GameConfig, VDXFKeySet } from '../types';
import { CHESS_VDXF_KEYS } from './vdxf-keys';
import { initialPieces } from './constants';

// Map chess-specific VDXF key names to generic slots
const vdxfKeys: VDXFKeySet = {
  version:       CHESS_VDXF_KEYS.version,
  player1:       CHESS_VDXF_KEYS.white,
  player2:       CHESS_VDXF_KEYS.black,
  winner:        CHESS_VDXF_KEYS.winner,
  result:        CHESS_VDXF_KEYS.result,
  moves:         CHESS_VDXF_KEYS.moves,
  movecount:     CHESS_VDXF_KEYS.movecount,
  duration:      CHESS_VDXF_KEYS.duration,
  startedat:     CHESS_VDXF_KEYS.startedat,
  gamehash:      CHESS_VDXF_KEYS.gamehash,
  player1sig:    CHESS_VDXF_KEYS.whitesig,
  player2sig:    CHESS_VDXF_KEYS.blacksig,
  mode:          CHESS_VDXF_KEYS.mode,
  movesigs:      CHESS_VDXF_KEYS.movesigs,
  player1opensig: CHESS_VDXF_KEYS.whiteopensig,
  player2opensig: CHESS_VDXF_KEYS.blackopensig,
  status:        CHESS_VDXF_KEYS.status,
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
  subIdPrefix: 'chess-game',

  BoardComponent: lazy(() => import('./Board')),
  SidebarComponent: undefined, // Chess sidebar handled inside GameClient for now

  createInitialState: () => ({
    pieces: initialPieces,
    totalTurns: 0,
    currentTeam: 'w',
    winningTeam: null,
    capturedPieces: [],
  }),

  // These are used client-side by the board component internally.
  // Server does not call them — hash chain provides integrity.
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
```

- [ ] **Step 2: Register chess in the registry**

Update `app/games/registry.ts` to import and register chess:

```typescript
import type { GameConfig } from './types';
import { chessConfig } from './chess/config';

const GAME_REGISTRY: Record<string, GameConfig> = {
  chess: chessConfig,
};
// ... rest unchanged
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/games/chess/config.ts app/games/registry.ts
git commit -m "feat: add chess game config and register in game registry"
```

---

### Task 4: Database Schema Migration

Rename `whitePlayer`/`blackPlayer` to `player1`/`player2`, add `gameType` column, update `GameCounter` to per-game-type, add `gameType` to `SubIdPool`.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, make these changes:

**Game model:**
- Add `gameType String @default("chess")` after `updatedAt`
- Rename `whitePlayer` → `player1`, `whitePlayerId` → `player1Id`
- Rename `blackPlayer` → `player2`, `blackPlayerId` → `player2Id`
- Update relation names: `"WhitePlayer"` → `"Player1"`, `"BlackPlayer"` → `"Player2"`

**User model:**
- Rename `gamesAsWhite` → `gamesAsPlayer1`, relation `"WhitePlayer"` → `"Player1"`
- Rename `gamesAsBlack` → `gamesAsPlayer2`, relation `"BlackPlayer"` → `"Player2"`

**GameSession model:**
- `whiteFinalSig` → `player1FinalSig`
- `blackFinalSig` → `player2FinalSig`
- `whiteOpeningSig` → `player1OpeningSig`
- `blackOpeningSig` → `player2OpeningSig`

**GameCounter model:**
- Change comment: `// 'chess', 'checkers' — per-game-type counter`

**SubIdPool model:**
- Add `gameType String @default("chess")` after `id`
- Remove `@unique` from `gameNumber`
- Add `@@unique([gameType, gameNumber])`

- [ ] **Step 2: Do NOT run `prisma generate` yet**

The schema uses new column names but all consuming code still uses old names. Running `prisma generate` now would break the TypeScript build. The generate step is deferred to the end of Task 6 when all code is updated. **Tasks 4, 5, and 6 must be done as a contiguous block with no interleaving.** Do not commit until Task 6 is complete.

---

### Task 5: Shared Engine Refactoring

Update all shared utilities to accept game config parameters instead of hardcoded chess references. This is the largest task — every function that read `CHESSGAME_*` env vars now receives values from callers.

**Files:**
- Modify: `app/utils/verus-rpc.ts`
- Modify: `app/utils/game-counter.ts`
- Modify: `app/utils/modes/normal/hash-chain.ts`
- Modify: `app/utils/modes/normal/subid-storage.ts`
- Modify: `app/utils/chain-reader.ts`
- Modify: `app/utils/subid-pool.ts`
- Modify: `app/utils/modes/types.ts`
- Modify: `app/utils/modes/normal/handler.ts`
- Modify: `app/utils/modes/showcase/handler.ts`
- Modify: `app/utils/modes/showcase/live-storage.ts`

- [ ] **Step 1: Update `verus-rpc.ts`**

Change `buildSubIdFullName` to accept the parent identity as a parameter:

```typescript
export function buildSubIdFullName(subIdName: string, parentIdentityName?: string): string {
  const parentName = parentIdentityName || process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  return `${subIdName}.${parentName.replace('@', '')}@`;
}
```

The optional parameter maintains backward compatibility during migration.

- [ ] **Step 2: Update `game-counter.ts`**

Change to per-game-type counters with a configurable prefix:

```typescript
export async function nextGameNumber(
  gameType: string = 'chess',
  prefix: string = 'game'
): Promise<{ gameNumber: number; subIdName: string }> {
  await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES (${gameType}, 1)`;
  const gameNumber = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = ${gameType}`;
    const result = await tx.gameCounter.findUnique({ where: { id: gameType } });
    return result!.nextGame - 1;
  });
  const subIdName = `${prefix}${String(gameNumber).padStart(4, '0')}`;
  return { gameNumber, subIdName };
}
```

- [ ] **Step 3: Update `hash-chain.ts`**

Rename parameters but preserve the internal JSON field names for backward compatibility:

```typescript
export function computeAnchorHash(subIdName: string, player1: string, player2: string): string {
  // IMPORTANT: Internal field names stay 'white'/'black' to preserve existing hash chains
  const anchor = {
    subIdName,
    white: player1,
    black: player2,
    startPos: 'standard',
  };
  const canonical = JSON.stringify(anchor, Object.keys(anchor).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export function verifyChain(
  subIdName: string,
  player1: string,
  player2: string,
  packages: MovePackageData[],
): { valid: boolean; error?: string; moveNum?: number } {
  // Update the parameter passed to computeAnchorHash
  const anchorHash = computeAnchorHash(subIdName, player1, player2);
  // ... rest stays the same
}
```

- [ ] **Step 4: Update `modes/types.ts`**

Rename `GameEndResult` fields:

```typescript
export interface GameEndResult {
  gameHash: string;
  player1FinalSig: string;   // was whiteFinalSig
  player2FinalSig: string;   // was blackFinalSig
  verified: boolean;
}
```

- [ ] **Step 5: Update `subid-storage.ts`**

Accept `VDXFKeySet` and parent identity as parameters:

```typescript
import { rpcCall, waitForConfirmation, buildSubIdFullName } from '@/app/utils/verus-rpc';
import { dd } from '@/app/utils/data-descriptor';
import type { VDXFKeySet } from '@/app/games/types';

export interface GameData {
  player1Name: string;
  player2Name: string;
  winner: string;
  result: string;
  moves: string[];
  moveCount: number;
  duration: number;
  startedAt: number;
  gameHash: string;
  player1Sig: string;
  player2Sig: string;
  mode: string;
  moveSigs?: string[];
}

export async function createGameSubId(
  subIdName: string,
  parentIdentityAddress?: string,
): Promise<{ address: string }> {
  const parentAddress = parentIdentityAddress || process.env.CHESSGAME_IDENTITY_ADDRESS;
  const fullName = buildSubIdFullName(subIdName);
  // ... rest of function with parentAddress replacing process.env.CHESSGAME_IDENTITY_ADDRESS
}

export async function storeGameData(
  subIdName: string,
  data: GameData,
  keys: VDXFKeySet,
  parentIdentityName?: string,
): Promise<{ txid: string }> {
  const fullName = buildSubIdFullName(subIdName, parentIdentityName);

  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  const K = keys;
  const contentmultimap: Record<string, object[]> = {
    [K.version.vdxfid]:      [dd('1',                           K.version.uri)],
    [K.player1.vdxfid]:      [dd(data.player1Name,              K.player1.uri)],
    [K.player2.vdxfid]:      [dd(data.player2Name,              K.player2.uri)],
    [K.winner.vdxfid]:       [dd(data.winner,                   K.winner.uri)],
    [K.result.vdxfid]:       [dd(data.result,                   K.result.uri)],
    [K.moves.vdxfid]:        [dd(JSON.stringify(data.moves),    K.moves.uri, 'application/json')],
    [K.movecount.vdxfid]:    [dd(String(data.moveCount),        K.movecount.uri)],
    [K.duration.vdxfid]:     [dd(String(data.duration),         K.duration.uri + ' (seconds)')],
    [K.startedat.vdxfid]:    [dd(String(data.startedAt),        K.startedat.uri)],
    [K.gamehash.vdxfid]:     [dd(data.gameHash,                 K.gamehash.uri)],
    [K.player1sig.vdxfid]:   [dd(data.player1Sig,               K.player1sig.uri)],
    [K.player2sig.vdxfid]:   [dd(data.player2Sig,               K.player2sig.uri)],
    [K.mode.vdxfid]:         [dd(data.mode,                     K.mode.uri)],
  };

  if (data.moveSigs && data.moveSigs.length > 0) {
    contentmultimap[K.movesigs.vdxfid] = [dd(JSON.stringify(data.moveSigs), K.movesigs.uri, 'application/json')];
  }

  const updateParams = { ...identity, contentmultimap };
  const txid = await rpcCall('updateidentity', [updateParams]);
  return { txid };
}
```

- [ ] **Step 6: Update `chain-reader.ts`**

Accept game type, load correct VDXFKeySet:

```typescript
import { DD_KEY } from '@/app/utils/data-descriptor';
import { rpcCall, buildSubIdFullName } from './verus-rpc';
import { getGameConfig } from '@/app/games/registry';

function buildKeyLookup(gameType: string): Record<string, string> {
  const config = getGameConfig(gameType);
  const lookup: Record<string, string> = {};
  for (const [slot, def] of Object.entries(config.vdxfKeys)) {
    lookup[def.vdxfid] = slot;
  }
  return lookup;
}

// Update OnChainGame interface: white→player1, black→player2, etc.
// Update readGameFromChain to accept gameType parameter
// Update listGamesFromChain to accept gameType, use config.parentIdentityName
```

Update `OnChainGame` interface fields: `white` → `player1`, `black` → `player2`, `whiteName` → `player1Name`, `blackName` → `player2Name`, `whiteSig` → `player1Sig`, `blackSig` → `player2Sig`, `whiteOpenSig` → `player1OpenSig`, `blackOpenSig` → `player2OpenSig`. Add `gameType: string` field.

- [ ] **Step 7: Update `subid-pool.ts`**

Add `gameType` parameter to pool functions:

- `popReadySubId(gameType: string)` — add `where: { status: 'ready', gameType }` filter
- `ensurePoolSize(minSize, gameType, parentIdentityAddress)` — pass gameType to queries and `registerSubId`
- `registerSubId(existingRecord, gameType, parentIdentityAddress)` — use passed parentIdentityAddress instead of `process.env.CHESSGAME_IDENTITY_ADDRESS`, call `nextGameNumber(gameType, prefix)` instead of `nextGameNumber()`
- `getPoolStatus(gameType?)` — optionally filter by gameType
- `registerOneSubId(gameType, parentIdentityAddress)` — pass through

- [ ] **Step 8: Update normal mode handler**

In `app/utils/modes/normal/handler.ts`:

- Import `getGameConfig` from `@/app/games/registry`
- In `onMove`: replace `game.whitePlayer` → `game.player1`, `game.blackPlayer` → `game.player2`
- In `onGameEnd`: same player renames, change `whiteFinalSig`/`blackFinalSig` → `player1FinalSig`/`player2FinalSig` in `GameSession` updates and return value
- In `storeOnChain`: load `const config = getGameConfig(game.gameType || 'chess')`, use `config.vdxfKeys` and `config.parentIdentityName` when calling `storeGameData`, rename `whiteName`/`blackName` → `player1Name`/`player2Name` in GameData, use `getPlayerName(fullGame.player1)` and `getPlayerName(fullGame.player2)`

- [ ] **Step 9: Update showcase mode handler and live-storage**

Same changes as normal handler. In `live-storage.ts`, import `dd` from `@/app/utils/data-descriptor` and accept `VDXFKeySet` parameter instead of importing `CHESS_VDXF_KEYS`.

- [ ] **Step 10: Do not commit yet — continue to Task 6**

Tasks 4, 5, and 6 are an atomic block. The build won't pass until all Prisma queries are updated.

---

### Task 6: Update Server Actions and API Routes

All Prisma queries need `player1`/`player2` instead of `whitePlayer`/`blackPlayer`. Game creation uses `gameConfig.createInitialState()`.

**Files:**
- Modify: `app/game/[gameId]/actions.ts`
- Modify: `app/api/game/route.ts`
- Modify: `app/api/game/[gameId]/route.ts`
- Modify: `app/api/game/[gameId]/store-blockchain/route.ts`
- Modify: `app/api/game/[gameId]/verify/route.ts`
- Modify: `app/api/game/[gameId]/showcase-sign/route.ts`
- Modify: `app/api/game/[gameId]/store-move-blockchain/route.ts`
- Modify: `app/api/games/route.ts`
- Modify: `app/api/chain/games/route.ts` (if exists)
- Modify: `app/users/actions.ts`

- [ ] **Step 1: Update `actions.ts` (server actions)**

```typescript
// getGame: whitePlayer→player1, blackPlayer→player2 in include
// updateGame: whitePlayerId→player1Id, blackPlayerId→player2Id in player resolution
// endGame: change param from 'OUR'|'OPPONENT'|'DRAW' to 1|2|'DRAW'
export async function endGame(gameId: string, winningPlayer: 1 | 2 | 'DRAW') {
    const existingGame = await prisma.game.findUnique({
        where: { id: gameId },
        include: { player1: true, player2: true },
    });
    let winnerId: string | null = null;
    if (winningPlayer === 1) winnerId = existingGame?.player1Id ?? null;
    else if (winningPlayer === 2) winnerId = existingGame?.player2Id ?? null;
    // ... rest same with player1/player2 includes
}
```

- [ ] **Step 2: Update `app/api/game/route.ts` (game creation)**

```typescript
import { getGameConfig, isValidGameType } from '@/app/games/registry';

export async function POST(req: Request) {
    const { player1Id, player2Id, mode, boardTheme, logoMode, gameType } = await req.json();

    if (!player1Id || !player2Id) {
        return new NextResponse('Missing player IDs', { status: 400 });
    }

    const validGameType = (gameType && isValidGameType(gameType)) ? gameType : 'chess';
    const config = getGameConfig(validGameType);

    const initialBoardState = config.createInitialState();
    const gameMode = mode || 'normal';

    const newGame = await prisma.game.create({
        data: {
            gameType: validGameType,
            player1Id,
            player2Id,
            boardState: initialBoardState,
            status: 'IN_PROGRESS',
            mode: gameMode,
            boardTheme: validTheme,
            logoMode: validLogoMode,
        },
    });

    if (gameMode === 'normal' && config.chainEnabled) {
        const { subIdName } = await nextGameNumber(validGameType, config.subIdPrefix + '-');
        // ... SubID commitment with config.parentIdentityAddress
    } else if (gameMode === 'showcase' && config.chainEnabled) {
        const poolSubId = await popReadySubId(validGameType);
        // ... pool logic with gameType
    }
    // ... rest same
}
```

- [ ] **Step 3: Update remaining API routes**

For each API route that includes `whitePlayer`/`blackPlayer` in Prisma queries, replace with `player1`/`player2`. This is a mechanical find-and-replace in each file:

- `app/api/game/[gameId]/route.ts`: `whitePlayer: true` → `player1: true`, `blackPlayer: true` → `player2: true`
- `app/api/game/[gameId]/store-blockchain/route.ts`: same renames, plus load `getGameConfig(game.gameType)` for the handler
- `app/api/game/[gameId]/verify/route.ts`: same renames
- `app/api/game/[gameId]/showcase-sign/route.ts`: rename all `whitePlayerId`→`player1Id`, `blackPlayerId`→`player2Id`, `whiteOpeningSig`→`player1OpeningSig`, `blackOpeningSig`→`player2OpeningSig`, `whiteFinalSig`→`player1FinalSig`, `blackFinalSig`→`player2FinalSig`
- `app/api/games/route.ts`: `whitePlayer: true` → `player1: true`, `blackPlayer: true` → `player2: true`
- `app/games/actions.ts`: `whitePlayer: true` → `player1: true`, `blackPlayer: true` → `player2: true`
- `app/api/chain/games/route.ts`: add `gameType` query param, pass to `listGamesFromChain(gameType)` and `readGameFromChain(subIdName, gameType)`
- `app/users/actions.ts`: same renames in Prisma includes

- [ ] **Step 4: Now run prisma generate and reset DB (deferred from Task 4)**

```bash
npx prisma db push --force-reset
npx prisma generate
```

- [ ] **Step 5: Verify build**

```bash
npx next build
```

Expected: builds successfully — all Prisma queries use new column names.

- [ ] **Step 6: Commit Tasks 4, 5, and 6 together**

```bash
git add prisma/schema.prisma app/utils/ app/games/ app/api/ app/game/ app/users/
git commit -m "refactor: rename white/black to player1/player2, parameterize engine by game config"
```

---

### Task 7: Update server.js

Add `gameType` to socket event payloads, rename player fields.

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Update `pendingChallenges` to include `gameType`**

Line 42: add `gameType` to the comment and the push on line 102-106:
```javascript
pendingChallenges.push({
    challengerId, challengerName, challengeeId, mode,
    boardTheme: boardTheme || 'classic', logoMode: logoMode || 'off',
    gameType: gameType || 'chess',  // NEW
    timestamp: Date.now()
});
```

- [ ] **Step 2: Update `challenge-user` handler**

Add `gameType` to destructured params (line 98) and relay it in `new-challenge` emit (line 112-119):
```javascript
socket.on('challenge-user', ({ challengerId, challengerName, challengeeId, mode, boardTheme, logoMode, gameType }) => {
    // ... pendingChallenges.push includes gameType
    // ... emit includes gameType: gameType || 'chess'
});
```

- [ ] **Step 3: Update `start-game` handler**

Add `gameType` to destructured params (line 166). Change POST body (lines 179-184):
```javascript
body: JSON.stringify({
    player1Id: white, player2Id: black,  // was whitePlayerId, blackPlayerId
    mode: mode || 'normal',
    boardTheme: boardTheme || 'classic',
    logoMode: logoMode || 'off',
    gameType: gameType || 'chess',  // NEW
}),
```

Also emit `gameType` in `game-started` (line 200).

- [ ] **Step 4: Update `rematch-accept` handler**

Lines 299-308: rename `whitePlayerId`/`blackPlayerId` to `player1Id`/`player2Id` when reading from `originalGame` and when building `newGameData`:
```javascript
const [p1, p2] = Math.random() < 0.5
    ? [originalGame.player1Id, originalGame.player2Id]
    : [originalGame.player2Id, originalGame.player1Id];
const newGameData = {
    player1Id: p1,
    player2Id: p2,
    mode: originalGame.mode || 'normal',
    boardTheme: originalGame.boardTheme || 'classic',
    logoMode: originalGame.logoMode || 'off',
    gameType: originalGame.gameType || 'chess',  // NEW
};
```

- [ ] **Step 5: Update `challenge-accepted-busy` handler**

Add `gameType` to destructured params and `ready-to-play` emit.

- [ ] **Step 6: Verify by starting the server**

```bash
node server.js
```

Expected: starts on port 3002 with no errors.

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "refactor: add gameType to socket events, rename player fields"
```

---

### Task 8: Shared UI Components — Rename Directory and Update

Move remaining `components/chessboard/` files to `components/game/`. Update chess-specific labels to use game config.

**Files:**
- Move: `components/chessboard/GameOver.tsx` → `components/game/GameOver.tsx`
- Move: `components/chessboard/GameMoves.tsx` → `components/game/GameMoves.tsx`
- Move: `components/chessboard/SubIdStatus.tsx` → `components/game/SubIdStatus.tsx`
- Move: `components/chessboard/BlockchainInfoDialog.tsx` → `components/game/BlockchainInfoDialog.tsx`
- Move: `components/chessboard/ShowcaseSigningPrompt.tsx` → `components/game/ShowcaseSigningPrompt.tsx`
- Move: `components/chessboard/ChallengeModal.tsx` → `components/game/ChallengeModal.tsx`
- Modify: `components/dashboard/SocketRegistration.tsx`
- Modify: `components/dashboard/ChallengeContext.tsx`

- [ ] **Step 1: Move shared components to `components/game/`**

```bash
mkdir -p components/game
mv components/chessboard/GameOver.tsx components/game/
mv components/chessboard/GameMoves.tsx components/game/
mv components/chessboard/SubIdStatus.tsx components/game/
mv components/chessboard/BlockchainInfoDialog.tsx components/game/
mv components/chessboard/ShowcaseSigningPrompt.tsx components/game/
mv components/chessboard/ChallengeModal.tsx components/game/
```

- [ ] **Step 2: Update all consuming imports**

In `app/game/[gameId]/GameClient.tsx`:
- `@/components/chessboard/GameOver` → `@/components/game/GameOver`
- `@/components/chessboard/GameMoves` → `@/components/game/GameMoves`
- `@/components/chessboard/SubIdStatus` → `@/components/game/SubIdStatus`
- `@/components/chessboard/ShowcaseSigningPrompt` → `@/components/game/ShowcaseSigningPrompt`

In `app/users/page.tsx`:
- `@/components/chessboard/BlockchainInfoDialog` → `@/components/game/BlockchainInfoDialog`
- `@/components/chessboard/ChallengeModal` → `@/components/game/ChallengeModal`

- [ ] **Step 3: Update `GameOver.tsx` chess-specific strings**

- `session?.whiteFinalSig` → `session?.player1FinalSig`
- `session?.blackFinalSig` → `session?.player2FinalSig`
- Hardcoded `"White:"` / `"Black:"` labels → use `gameConfig.player1Label` / `gameConfig.player2Label` (pass config or labels as props)
- Hardcoded `.ChessGame@` → use `gameConfig.parentIdentityName` (pass as prop)
- Add `chainEnabled` guard: if `!gameConfig.chainEnabled`, hide the blockchain signing/storage section entirely (similar to existing `hasChainSupport` check)

- [ ] **Step 4: Update `ShowcaseSigningPrompt.tsx`**

Change `player: 'white' | 'black'` prop to `player: 1 | 2`, use game config labels for display.

- [ ] **Step 5: Update `ChallengeModal.tsx`**

Add game type picker at the top:
- Import `getAllGameTypes` from `@/app/games/registry`
- Add `selectedGameType` state (default `'chess'`)
- Render game type buttons from `getAllGameTypes()`
- When `chainEnabled === false`, grey out showcase mode with tooltip
- Pass `gameType` in the `onConfirm` callback

- [ ] **Step 6: Update `ChallengeContext.tsx`**

Add `gameType` field to the `Challenge` interface.

- [ ] **Step 7: Update `SocketRegistration.tsx`**

- Rename `__chessSocket` → `__gameSocket`
- Add `gameType` to the `new-challenge` handler's `addChallenge` call

- [ ] **Step 8: Update `BlockchainInfoDialog.tsx`**

Replace hardcoded `ChessGame@` references with a `parentIdentityName` prop.

- [ ] **Step 9: Update `GameMoves.tsx`**

Add `chainEnabled` guard — if the game's config has `chainEnabled: false`, don't fire blockchain API calls.

- [ ] **Step 10: Verify build**

```bash
npx next build
```

- [ ] **Step 11: Commit**

```bash
git add components/game/ components/chessboard/ components/dashboard/ app/game/ app/users/
git commit -m "refactor: move shared UI to components/game/, add game type awareness"
```

---

### Task 9: GameClient Rewrite and Routing

Update GameClient for dynamic board/sidebar loading. Move browsing pages to `[gameType]/` routes. Update sidebar nav.

**Files:**
- Modify: `app/game/[gameId]/GameClient.tsx`
- Create: `app/[gameType]/games/page.tsx`
- Move: `app/games/GameList.tsx` → `app/[gameType]/games/GameList.tsx`
- Move: `app/games/actions.ts` → `app/[gameType]/games/actions.ts`
- Create: `app/[gameType]/offline/page.tsx`
- Modify: `lib/constants.ts`
- Modify: `app/users/page.tsx`

- [ ] **Step 1: Update `GameClient.tsx`**

Key changes:
- Import `getGameConfig` from `@/app/games/registry`
- Remove direct chess imports (`Chessboard`, `MoveHistory`, `PromotionDialog`, `CapturedPiecesPanel`, chess `Piece`/`Board`/`Position`/`Pawn` models, `PieceType`/`TeamType`)
- Load board component dynamically: `const config = getGameConfig(gameState.gameType || 'chess')`
- Replace `currentPlayer: 'white' | 'black'` with `currentPlayer: 1 | 2`
- Replace all `whitePlayer`/`blackPlayer` references with `player1`/`player2`
- Replace `whitePlayerId`/`blackPlayerId` with `player1Id`/`player2Id`
- Replace `endGame(gameId, 'OUR')` with `endGame(gameId, 1)` and `endGame(gameId, 'OPPONENT')` with `endGame(gameId, 2)`
- Render `<config.BoardComponent>` instead of `<Chessboard>`
- Chess-specific code (promotion dialog, `createBoardFromState`, chess model hydration) needs to move into the chess Board component or stay in GameClient behind a `gameType === 'chess'` guard until the Board component fully encapsulates chess logic

**Note:** The chess `Board.tsx` component (formerly `Chessboard.tsx`) currently receives raw props and does its own piece rendering. The `GameClient` does chess-specific model hydration (`createBoardFromState`). For now, keep `createBoardFromState` in GameClient behind a `if (gameType === 'chess')` guard. Full encapsulation (where the board component handles its own state hydration) is a follow-up.

- [ ] **Step 2: Create `app/[gameType]/games/page.tsx`**

```typescript
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GameList from "./GameList";
import { getGameConfig } from "@/app/games/registry";
import { notFound } from "next/navigation";

export default function GamesPage({ params }: { params: { gameType: string } }) {
    const config = getGameConfig(params.gameType);
    if (!config) notFound();

    return (
        <DashboardLayout>
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">{config.displayName} Games</h1>
                <p className="text-muted-foreground">
                    Games stored on the Verus blockchain as SubIDs under {config.parentIdentityName}
                </p>
                <GameList gameType={params.gameType} />
            </div>
        </DashboardLayout>
    );
}
```

- [ ] **Step 3: Move and update `GameList.tsx`**

Move to `app/[gameType]/games/GameList.tsx`. Update:
- `OnChainGame` interface: `white`→`player1`, `black`→`player2`, etc.
- Player labels use game config
- Move formatting uses `config.formatMoveForDisplay()`
- Replace hardcoded `.ChessGame@` with config identity name

- [ ] **Step 4: Create `app/[gameType]/offline/page.tsx`**

```typescript
'use client';
import { getGameConfig } from '@/app/games/registry';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Suspense } from 'react';

export default function OfflinePage({ params }: { params: { gameType: string } }) {
    const config = getGameConfig(params.gameType);
    const BoardComponent = config.BoardComponent;
    const initialState = config.createInitialState();

    return (
        <DashboardLayout>
            <Suspense fallback={<div>Loading...</div>}>
                <BoardComponent
                    boardState={initialState}
                    currentPlayer={1}
                    onMove={() => {}}
                    boardTheme="classic"
                    logoMode="off"
                />
            </Suspense>
        </DashboardLayout>
    );
}
```

**Note:** Offline play needs local state management. For now, this is a static board preview. Full offline play (alternating turns, move validation) is a follow-up since the chess offline page has extensive chess-specific state management that needs encapsulation into the board component.

- [ ] **Step 5: Update sidebar navigation**

In `lib/constants.ts`, replace hardcoded game links with dynamic ones. Since `SidebarItems` is a static array and can't call `getAllGameTypes()` at import time (it's a server call), use a simpler approach:

```typescript
export const SidebarItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/users", label: "Challenge Players", icon: Users },
    { href: "/chess/games", label: "Chess On-Chain", icon: Trophy },
    { href: "/checkers/games", label: "Checkers On-Chain", icon: Trophy },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/chess/offline", label: "Chess Offline", icon: Crown },
    { href: "/checkers/offline", label: "Checkers Offline", icon: Crown },
    { href: "/settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 6: Handle `/games` route redirect**

After moving `app/games/page.tsx` to `app/[gameType]/games/page.tsx`, the old `/games` URL becomes a 404. Add a redirect page at `app/games/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
export default function GamesRedirect() {
  redirect('/chess/games');
}
```

Similarly, add `app/game/page.tsx` as a redirect to `/chess/offline` (replacing the old offline chess page that was using imports from the old paths):

```typescript
import { redirect } from 'next/navigation';
export default function GameRedirect() {
  redirect('/chess/offline');
}
```

- [ ] **Step 7: Update `app/users/page.tsx`**

- Pass `gameType` from ChallengeModal to the `challenge-sent` CustomEvent and `challenge-user` socket emit
- Replace `whitePlayerId`/`blackPlayerId` references in game history display with `player1Id`/`player2Id`
- Use game config labels instead of hardcoded "White"/"Black"

- [ ] **Step 8: Verify build and manual test**

```bash
npx prisma db push --force-reset
npx prisma generate
node server.js &
npx next dev
```

Open browser, log in, verify:
1. Dashboard loads
2. Users page loads
3. Challenge modal opens with game type picker (chess only for now)
4. Can challenge and play a chess game
5. Game over flow works
6. `/chess/games` page loads

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: dynamic game routing, GameClient rewrite, sidebar with game links"
```

---

### Task 10: Checkers Implementation

Build the checkers game — board, rules, models, config. Register in the registry.

**Files:**
- Create: `app/games/checkers/types.ts`
- Create: `app/games/checkers/models/CheckerPiece.ts`
- Create: `app/games/checkers/constants.ts`
- Create: `app/games/checkers/rules.ts`
- Create: `app/games/checkers/Board.tsx`
- Create: `app/games/checkers/Board.css`
- Create: `app/games/checkers/Sidebar.tsx`
- Create: `app/games/checkers/vdxf-keys.ts`
- Create: `app/games/checkers/config.ts`
- Modify: `app/games/registry.ts`

- [ ] **Step 1: Create checkers types**

```typescript
// app/games/checkers/types.ts
export enum PieceType {
  REGULAR = 'regular',
  KING = 'king',
}

export enum Team {
  RED = 'red',    // player1
  BLACK = 'black', // player2
}
```

- [ ] **Step 2: Create checker piece model**

```typescript
// app/games/checkers/models/CheckerPiece.ts
import { PieceType, Team } from '../types';

export interface CheckerPiece {
  row: number;     // 0-7
  col: number;     // 0-7
  team: Team;
  type: PieceType;
}
```

- [ ] **Step 3: Create checkers constants**

```typescript
// app/games/checkers/constants.ts
import { CheckerPiece } from './models/CheckerPiece';
import { PieceType, Team } from './types';

export const BOARD_SIZE = 8;

export function createInitialPieces(): CheckerPiece[] {
  const pieces: CheckerPiece[] = [];
  // Red pieces on rows 0-2 (dark squares only)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        pieces.push({ row, col, team: Team.RED, type: PieceType.REGULAR });
      }
    }
  }
  // Black pieces on rows 5-7
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        pieces.push({ row, col, team: Team.BLACK, type: PieceType.REGULAR });
      }
    }
  }
  return pieces;
}
```

- [ ] **Step 4: Create checkers rules engine**

```typescript
// app/games/checkers/rules.ts
import { CheckerPiece } from './models/CheckerPiece';
import { PieceType, Team } from './types';

export interface CheckersState {
  pieces: CheckerPiece[];
  currentTeam: Team;
  capturedRed: number;
  capturedBlack: number;
}

export function getValidMoves(state: CheckersState, piece: CheckerPiece): string[] { ... }
export function isValidMove(state: CheckersState, move: string, team: Team): boolean { ... }
export function applyMove(state: CheckersState, move: string): CheckersState { ... }
export function getJumps(state: CheckersState, piece: CheckerPiece): string[] { ... }
export function mustJump(state: CheckersState, team: Team): boolean { ... }
export function isGameOver(state: CheckersState): { over: boolean; winner: Team | null } { ... }
```

Move format: `"r1c1-r2c2"` (from row,col to row,col). Jumps: `"r1c1-r3c3"` (jumping over the piece between). Multi-jumps: `"r1c1-r3c3-r5c5"`.

Implement:
- Diagonal forward moves for regular pieces (toward opposite end)
- Diagonal forward+backward for kings
- Forced jumps (if a jump is available, must take it)
- Multi-jump chains
- Kinging when reaching the opposite back row
- Win detection: opponent has no pieces or no valid moves

- [ ] **Step 5: Create checkers board component**

```typescript
// app/games/checkers/Board.tsx
'use client';
import './Board.css';
import type { BoardProps } from '../types';
import { CheckerPiece } from './models/CheckerPiece';
import { CheckersState, getValidMoves, isValidMove, applyMove, mustJump } from './rules';
import { getTheme } from '@/app/utils/board-themes';
// ... render 8x8 grid, circular pieces, valid move indicators, handle clicks
```

The board component:
- Renders 8x8 grid using CSS variables (`--square-light`, `--square-dark`) from `boardTheme` prop, same as chess
- Shows circular pieces (red/black) on dark squares
- Crown icon for king pieces
- Highlights valid moves on piece selection
- Enforces forced jumps (only shows jump moves when jumps available)
- Handles multi-jump sequences
- Kings pieces that reach the back row
- Calls `onMove(moveString, newBoardState)` on valid moves
- Supports Verus logo overlay (same as chess)

- [ ] **Step 6: Create checkers sidebar**

```typescript
// app/games/checkers/Sidebar.tsx
import type { SidebarProps } from '../types';

export default function CheckersSidebar({ boardState, moves, currentPlayer }: SidebarProps) {
  const state = boardState as any;
  return (
    <div className="space-y-4">
      <div>
        <h3>Captured</h3>
        <p>Red: {state.capturedRed || 0}</p>
        <p>Black: {state.capturedBlack || 0}</p>
      </div>
      <div>
        <h3>Moves ({moves.length})</h3>
        <div className="max-h-48 overflow-y-auto text-sm">
          {moves.map((m, i) => <div key={i}>{i + 1}. {m}</div>)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create checkers VDXF keys (stub)**

```typescript
// app/games/checkers/vdxf-keys.ts
// Placeholder — URIs defined but vdxfids empty until registered via getvdxfid on the daemon
export const CHECKERS_VDXF_KEYS = {
  version:       { uri: 'checkersgame::game.v1.version',       vdxfid: '' },
  red:           { uri: 'checkersgame::game.v1.red',           vdxfid: '' },
  black:         { uri: 'checkersgame::game.v1.black',         vdxfid: '' },
  winner:        { uri: 'checkersgame::game.v1.winner',        vdxfid: '' },
  result:        { uri: 'checkersgame::game.v1.result',        vdxfid: '' },
  moves:         { uri: 'checkersgame::game.v1.moves',         vdxfid: '' },
  movecount:     { uri: 'checkersgame::game.v1.movecount',     vdxfid: '' },
  duration:      { uri: 'checkersgame::game.v1.duration',       vdxfid: '' },
  startedat:     { uri: 'checkersgame::game.v1.startedat',     vdxfid: '' },
  gamehash:      { uri: 'checkersgame::game.v1.gamehash',      vdxfid: '' },
  redsig:        { uri: 'checkersgame::game.v1.redsig',        vdxfid: '' },
  blacksig:      { uri: 'checkersgame::game.v1.blacksig',      vdxfid: '' },
  mode:          { uri: 'checkersgame::game.v1.mode',          vdxfid: '' },
  movesigs:      { uri: 'checkersgame::game.v1.movesigs',      vdxfid: '' },
  redopensig:    { uri: 'checkersgame::game.v1.redopensig',    vdxfid: '' },
  blackopensig:  { uri: 'checkersgame::game.v1.blackopensig',  vdxfid: '' },
  status:        { uri: 'checkersgame::game.v1.status',        vdxfid: '' },
};
```

- [ ] **Step 8: Create checkers config**

```typescript
// app/games/checkers/config.ts
import { lazy } from 'react';
import type { GameConfig, VDXFKeySet } from '../types';
import { CHECKERS_VDXF_KEYS } from './vdxf-keys';
import { createInitialPieces } from './constants';
import { Team } from './types';
import { isValidMove, applyMove as applyCheckerMove, isGameOver } from './rules';

const vdxfKeys: VDXFKeySet = {
  version:       CHECKERS_VDXF_KEYS.version,
  player1:       CHECKERS_VDXF_KEYS.red,
  player2:       CHECKERS_VDXF_KEYS.black,
  winner:        CHECKERS_VDXF_KEYS.winner,
  result:        CHECKERS_VDXF_KEYS.result,
  moves:         CHECKERS_VDXF_KEYS.moves,
  movecount:     CHECKERS_VDXF_KEYS.movecount,
  duration:      CHECKERS_VDXF_KEYS.duration,
  startedat:     CHECKERS_VDXF_KEYS.startedat,
  gamehash:      CHECKERS_VDXF_KEYS.gamehash,
  player1sig:    CHECKERS_VDXF_KEYS.redsig,
  player2sig:    CHECKERS_VDXF_KEYS.blacksig,
  mode:          CHECKERS_VDXF_KEYS.mode,
  movesigs:      CHECKERS_VDXF_KEYS.movesigs,
  player1opensig: CHECKERS_VDXF_KEYS.redopensig,
  player2opensig: CHECKERS_VDXF_KEYS.blackopensig,
  status:        CHECKERS_VDXF_KEYS.status,
};

export const checkersConfig: GameConfig = {
  type: 'checkers',
  displayName: 'Checkers',
  description: 'Classic checkers — capture all opponent pieces',
  icon: '🏁',

  player1Label: 'Red',
  player2Label: 'Black',

  boardSize: 8,
  themeMode: 'grid',

  parentIdentityName: process.env.CHECKERSGAME_IDENTITY_NAME || 'CheckersGame@',
  parentIdentityAddress: process.env.CHECKERSGAME_IDENTITY_ADDRESS || '',
  signingWif: process.env.CHECKERSGAME_SIGNING_WIF || '',
  vdxfKeys,
  chainEnabled: false,  // Until CheckersGame@ is funded and VDXF keys registered
  subIdPrefix: 'checkers-game',

  BoardComponent: lazy(() => import('./Board')),
  SidebarComponent: lazy(() => import('./Sidebar')),

  createInitialState: () => ({
    pieces: createInitialPieces(),
    currentTeam: Team.RED,
    capturedRed: 0,
    capturedBlack: 0,
  }),

  validateMove: (state: any, move: string, player: 1 | 2) => {
    const team = player === 1 ? Team.RED : Team.BLACK;
    return isValidMove(state, move, team);
  },

  applyMove: (state: any, move: string) => {
    return applyCheckerMove(state, move);
  },

  getGameStatus: (state: any) => {
    const result = isGameOver(state);
    return {
      isOver: result.over,
      winner: result.winner === Team.RED ? 1 : result.winner === Team.BLACK ? 2 : null,
      result: result.over ? (result.winner ? 'capture-all' : 'draw') : 'in-progress',
      resultDisplay: result.over
        ? (result.winner ? 'All pieces captured!' : 'Draw!')
        : '',
    };
  },

  formatMoveForDisplay: (move: string) => move,
};
```

- [ ] **Step 9: Register checkers in the registry**

In `app/games/registry.ts`:

```typescript
import { chessConfig } from './chess/config';
import { checkersConfig } from './checkers/config';

const GAME_REGISTRY: Record<string, GameConfig> = {
  chess: chessConfig,
  checkers: checkersConfig,
};
```

- [ ] **Step 10: Add checkers env vars to `.env`**

```
# CheckersGame@ identity (not yet funded)
CHECKERSGAME_IDENTITY_NAME=CheckersGame@
CHECKERSGAME_IDENTITY_ADDRESS=
CHECKERSGAME_SIGNING_WIF=
```

- [ ] **Step 11: Verify full build and manual test**

```bash
npx prisma db push --force-reset
npx prisma generate
node server.js &
npx next dev
```

Test:
1. Open browser, log in with two accounts
2. Challenge player 2, select "Checkers" in game type picker
3. Game should create and load checkers board
4. Play moves — red pieces move diagonally forward
5. Forced jumps work
6. Kinging works at back row
7. Game ends when all pieces captured
8. GameOver shows without blockchain section (chainEnabled: false)
9. Chess still works exactly as before

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add checkers game with board, rules, and full platform integration"
```

---

### Task 11: Cleanup and CLAUDE.md Update

Remove old empty directories, update documentation, save memory.

**Files:**
- Delete: empty `app/models/` directory
- Delete: empty `app/referee/` directory
- Delete: empty `components/chessboard/` directory (should be empty after all moves)
- Delete: `app/lib/initialPieces.ts` (merged into chess constants)
- Modify: `CLAUDE.md`
- Modify: `.env.example`

- [ ] **Step 1: Clean up empty directories and dead files**

```bash
rmdir app/models app/referee components/chessboard 2>/dev/null || true
rm -f app/lib/initialPieces.ts
rm -f app/Types.ts app/Constants.ts  # if not already removed
```

Verify no remaining references to deleted paths:

```bash
grep -r "app/models/" --include="*.ts" --include="*.tsx" app/ components/ | grep -v node_modules | grep -v .next
grep -r "app/referee/" --include="*.ts" --include="*.tsx" app/ components/ | grep -v node_modules | grep -v .next
grep -r "components/chessboard/" --include="*.ts" --include="*.tsx" app/ components/ | grep -v node_modules | grep -v .next
```

Expected: no matches.

- [ ] **Step 2: Update CLAUDE.md**

Update the developer guide to reflect the new multi-game architecture:
- Update the architecture diagram
- Update the directory listing to show `app/games/chess/`, `app/games/checkers/`, `components/game/`
- Add a "Adding a New Game" section describing the GameConfig interface and registry
- Update the database schema description
- Update socket events with `gameType` field
- Update env vars section with per-game identity vars

- [ ] **Step 3: Update `.env.example`**

Add `CHECKERSGAME_IDENTITY_*` variables alongside the existing `CHESSGAME_IDENTITY_*` ones.

- [ ] **Step 4: Final verification**

```bash
npx next build
```

Play a full chess game end-to-end, then a checkers game. Both should work.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup dead files, update CLAUDE.md for multi-game platform"
```
