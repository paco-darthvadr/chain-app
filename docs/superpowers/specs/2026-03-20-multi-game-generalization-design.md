# Multi-Game Platform Generalization

## Goal

Generalize the chess-specific codebase into a multi-game platform where chess, checkers, and future games share the same blockchain storage engine, mode system, hash chain, SubID pool, challenge flow, and real-time multiplayer infrastructure. Each game plugs in its own board UI, rules engine, and VDXF key schema. Chess continues working exactly as before. Checkers is playable locally and online but without on-chain storage until `CheckersGame@` is funded.

## Decisions

- **Per-game parent identities** — `ChessGame@` for chess, `CheckersGame@` for checkers, etc. Each parent publishes its own VDXF schema in its contentmultimap. Clean separation and independent discoverability on-chain.
- **Generic player naming in code** — `player1` / `player2` everywhere in DB, API, socket events, mode handlers. Each game's config maps these to display labels ("White"/"Black" for chess, "Red"/"Black" for checkers). On-chain VDXF keys remain game-specific (e.g., `chessgame::game.v1.white`).
- **Game type resolved from DB** — Game pages (`/game/[gameId]`) fetch the game record and load the right board component dynamically. No game type in the game URL.
- **Game type in browsing URLs** — On-chain and offline pages use `/{gameType}/games` and `/{gameType}/offline`.
- **Game type picked in ChallengeModal** — One modal, game type as the first selection, mode and theme below.
- **Shared grid themes** — Chess and checkers (and any alternating-square game) share the existing 10 board themes. Games with `themeMode: 'custom'` define their own visuals.
- **Scope** — Full generalization of the engine + checkers stub with board UI and rules but no on-chain storage yet.
- **Winner column keeps player cuid** — The `winner` column continues storing the winning player's cuid (not `'PLAYER1'`/`'PLAYER2'`). This preserves leaderboard queries and avoids a semantic migration. The column is null for in-progress/draw games, or the cuid of the winner.
- **Anchor hash backward compatibility** — The `computeAnchorHash` internal JSON object keeps field names `{ subIdName, white, black, startPos }` to preserve existing hash chains. Only the function parameter names change to `player1`/`player2`. No existing chains break.
- **Chain-disabled games use normal mode** — Games with `chainEnabled: false` default to `normal` mode. The mode handler checks `chainEnabled` and skips chain operations gracefully. Showcase mode is greyed out in the ChallengeModal for chain-disabled games.

## Architecture

### Game Config Interface

Every game implements `GameConfig`. The shared engine consumes this interface — it never contains game-specific logic.

```typescript
// app/games/types.ts

interface VDXFKey {
  uri: string;      // 'chessgame::game.v1.white'
  vdxfid: string;   // 'iHQYL4kHxcppiFHNPKfQnUqGUpqXW1rGje'
}

interface VDXFKeySet {
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

type BoardState = Record<string, unknown>;

interface GameStatus {
  isOver: boolean;
  winner: 1 | 2 | null;
  result: string;           // on-chain value: 'checkmate', 'capture-all', 'draw'
  resultDisplay: string;    // UI display: 'Checkmate!', 'All pieces captured!'
}

interface BoardProps {
  boardState: BoardState;
  currentPlayer: 1 | 2;
  onMove: (move: string, newBoardState: BoardState) => void;
  boardTheme?: string;
  logoMode?: string;
  isSpectator?: boolean;
  disabled?: boolean;        // e.g., during showcase signing phase
}

interface SidebarProps {
  boardState: BoardState;
  moves: string[];
  currentPlayer: 1 | 2;
}

interface GameConfig {
  // Identity
  type: string;                        // 'chess' — URL-safe slug
  displayName: string;                 // 'Chess'
  description: string;                 // 'Classic chess'
  icon: string;                        // emoji or path

  // Players
  player1Label: string;                // 'White'
  player2Label: string;                // 'Black'

  // Board
  boardSize: number;                   // 8
  themeMode: 'grid' | 'custom';       // 'grid' = shared alternating square themes

  // Blockchain
  parentIdentityName: string;          // from env: 'ChessGame@'
  parentIdentityAddress: string;       // from env: i-address
  signingWif: string;                  // from env: signing key
  vdxfKeys: VDXFKeySet;
  chainEnabled: boolean;               // false = skip chain operations
  subIdPrefix: string;                 // 'chess-game' → 'chess-game0001'

  // Components (lazy-loaded for code splitting)
  BoardComponent: React.LazyExoticComponent<React.ComponentType<BoardProps>>;
  SidebarComponent?: React.LazyExoticComponent<React.ComponentType<SidebarProps>>;

  // Rules Engine
  createInitialState: () => BoardState;
  validateMove: (state: BoardState, move: string, player: 1 | 2) => boolean;
  applyMove: (state: BoardState, move: string, player: 1 | 2) => BoardState;
  getGameStatus: (state: BoardState) => GameStatus;

  // Display
  formatMoveForDisplay: (move: string, moveNum: number) => string;
}
```

**Important constraints on `BoardState`:** This is `Record<string, unknown>` because each game has its own internal structure. Shared code (GameClient, mode handlers, socket relay) must treat it as opaque — never access internal fields directly. Only the game's own `BoardComponent`, rules functions, and `SidebarComponent` may interpret boardState internals.

### Updated Shared Interfaces

The mode handler types and storage interfaces also adopt generic naming:

```typescript
// app/utils/modes/types.ts — UPDATED

interface MoveData {
  move: string;
  player: string;       // VerusID
  boardState: any;
}

interface GameEndResult {
  gameHash: string;
  player1FinalSig: string;   // was whiteFinalSig
  player2FinalSig: string;   // was blackFinalSig
  verified: boolean;
}

// SignedMovePackage, StorageResult, ModeHandler — unchanged
```

```typescript
// app/utils/modes/normal/subid-storage.ts — UPDATED GameData interface

interface GameData {
  player1Name: string;     // was white — display name e.g., "zenny@"
  player2Name: string;     // was black
  winner: string;          // display name of winner
  result: string;
  moves: string[];
  moveCount: number;
  duration: number;
  startedAt: number;
  gameHash: string;
  player1Sig: string;      // was whiteSig
  player2Sig: string;      // was blackSig
  mode: string;
  moveSigs?: string[];
}

// storeGameData maps GameData fields to VDXF keys:
//   gameData.player1Name → keys.player1.vdxfid
//   gameData.player2Name → keys.player2.vdxfid
//   gameData.player1Sig  → keys.player1sig.vdxfid
//   etc.
```

```typescript
// app/utils/chain-reader.ts — UPDATED OnChainGame interface

interface OnChainGame {
  subIdName: string;
  fullName: string;
  gameType: string;          // NEW
  identityAddress: string;
  blockheight: number;
  txid: string;
  version: string;
  player1: string;           // was white — i-address
  player2: string;           // was black
  player1Name: string | null;  // was whiteName — resolved friendly name
  player2Name: string | null;  // was blackName
  winner: string;
  winnerName: string | null;
  result: string;
  moves: string[];
  moveCount: number;
  duration: number;
  startedAt: number;
  gameHash: string;
  player1Sig: string;        // was whiteSig
  player2Sig: string;        // was blackSig
  mode: string;
  moveSigs: string[] | null;
  player1OpenSig: string | null;  // was whiteOpenSig
  player2OpenSig: string | null;  // was blackOpenSig
  status: string | null;
}
```

### Game Registry

```typescript
// app/games/registry.ts

import { chessConfig } from './chess/config';
import { checkersConfig } from './checkers/config';

const GAME_REGISTRY: Record<string, GameConfig> = {
  chess: chessConfig,
  checkers: checkersConfig,
};

export function getGameConfig(type: string): GameConfig;
export function getAllGameTypes(): GameConfig[];
export function isValidGameType(type: string): boolean;
```

Adding a new game: create its directory under `app/games/`, implement `GameConfig`, add one import line to the registry.

### Directory Structure

```
app/games/
├── types.ts                    # GameConfig, BoardProps, VDXFKeySet interfaces
├── registry.ts                 # Central registry + getGameConfig(), getAllGameTypes()
├── chess/
│   ├── config.ts               # chessConfig: GameConfig (reads env, wires everything)
│   ├── Board.tsx               # Chess board component (current Chessboard.tsx)
│   ├── Board.css               # Chess board styles (current Chessboard.css)
│   ├── Sidebar.tsx             # MoveHistory + CapturedPiecesPanel combined
│   ├── rules.ts                # Move validation (current referee/rules.ts)
│   ├── models/                 # Piece, Board, Position, Pawn (current app/models/)
│   ├── constants.ts            # initialBoard, axes, grid size (current Constants.ts)
│   ├── types.ts                # PieceType, TeamType (current Types.ts)
│   ├── vdxf-keys.ts            # chessgame::game.v1.* keys (VDXF keys only, DD_KEY extracted)
│   └── PromotionDialog.tsx     # Chess-specific promotion UI
└── checkers/
    ├── config.ts               # checkersConfig: GameConfig
    ├── Board.tsx               # Checkers board component
    ├── Board.css               # Checkers board styles
    ├── Sidebar.tsx             # Captured pieces display
    ├── rules.ts                # Checkers move validation (forced jumps, kinging)
    ├── models/                 # CheckerPiece, king logic
    ├── constants.ts            # Initial 12-piece setup
    ├── types.ts                # PieceType (regular/king)
    └── vdxf-keys.ts            # checkersgame::game.v1.* keys (stub)

app/utils/
├── verus-rpc.ts                # buildSubIdFullName(subIdName, parentIdentity)
├── game-counter.ts             # nextGameNumber(gameType, prefix)
├── subid-pool.ts               # parameterized by game config
├── chain-reader.ts             # accepts gameType, loads correct VDXFKeySet
├── board-themes.ts             # shared grid themes (unchanged)
├── data-descriptor.ts          # DD_KEY + dd() (extracted from vdxf-keys.ts)
└── modes/
    ├── types.ts                # ModeHandler, GameEndResult (player1/player2 naming)
    ├── mode-resolver.ts        # unchanged
    ├── normal/
    │   ├── handler.ts          # uses getGameConfig() for identity/keys
    │   ├── hash-chain.ts       # param names change, anchor hash internals preserved
    │   ├── subid-storage.ts    # accepts VDXFKeySet parameter
    │   └── move-signer.ts      # unchanged
    ├── showcase/handler.ts     # same changes as normal
    └── original/handler.ts     # unchanged (legacy)

components/
├── game/                       # shared game UI (renamed from chessboard/)
│   ├── GameOver.tsx            # uses gameConfig for labels + chainEnabled guard
│   ├── GameMoves.tsx           # chainEnabled guard, uses formatMoveForDisplay
│   ├── SubIdStatus.tsx         # chainEnabled guard
│   ├── BlockchainInfoDialog.tsx # uses gameConfig.parentIdentityName
│   ├── ShowcaseSigningPrompt.tsx # uses player 1|2 instead of 'white'|'black'
│   └── ChallengeModal.tsx      # game type picker added
└── dashboard/                  # unchanged

app/game/[gameId]/
├── page.tsx                    # unchanged
├── GameClient.tsx              # REWRITTEN: dynamic board/sidebar from registry
└── actions.ts                  # UPDATED: player1/player2 naming

app/[gameType]/
├── games/
│   ├── page.tsx                # on-chain game list (was app/games/page.tsx)
│   └── GameList.tsx            # shared list, parameterized by gameConfig
└── offline/
    └── page.tsx                # local game (was app/game/page.tsx)
```

### File Migration Table

| Current Path | New Path | Change |
|---|---|---|
| `components/chessboard/Chessboard.tsx` | `app/games/chess/Board.tsx` | Move to game directory |
| `components/chessboard/Chessboard.css` | `app/games/chess/Board.css` | Move to game directory |
| `components/chessboard/PromotionDialog.tsx` | `app/games/chess/PromotionDialog.tsx` | Move to game directory |
| `components/chessboard/MoveHistory.tsx` | `app/games/chess/Sidebar.tsx` | Merge with CapturedPiecesPanel |
| `components/chessboard/CapturedPiecesPanel.tsx` | `app/games/chess/Sidebar.tsx` | Merge into Sidebar |
| `components/chessboard/GameOver.tsx` | `components/game/GameOver.tsx` | Rename directory, add config |
| `components/chessboard/GameMoves.tsx` | `components/game/GameMoves.tsx` | Rename directory, add guards |
| `components/chessboard/SubIdStatus.tsx` | `components/game/SubIdStatus.tsx` | Rename directory |
| `components/chessboard/BlockchainInfoDialog.tsx` | `components/game/BlockchainInfoDialog.tsx` | Rename directory, parameterize |
| `components/chessboard/ShowcaseSigningPrompt.tsx` | `components/game/ShowcaseSigningPrompt.tsx` | Rename directory, player 1/2 |
| `components/chessboard/ChallengeModal.tsx` | `components/game/ChallengeModal.tsx` | Rename directory, add game picker |
| `app/models/Piece.ts` | `app/games/chess/models/Piece.ts` | Move |
| `app/models/Board.ts` | `app/games/chess/models/Board.ts` | Move |
| `app/models/Position.ts` | `app/games/chess/models/Position.ts` | Move |
| `app/models/Pawn.ts` | `app/games/chess/models/Pawn.ts` | Move |
| `app/models/index.ts` | `app/games/chess/models/index.ts` | Move |
| `app/Types.ts` | `app/games/chess/types.ts` | Move |
| `app/Constants.ts` | `app/games/chess/constants.ts` | Move |
| `app/lib/initialPieces.ts` | `app/games/chess/constants.ts` | Merge into constants |
| `app/referee/rules.ts` | `app/games/chess/rules.ts` | Move |
| `app/utils/modes/normal/vdxf-keys.ts` | `app/games/chess/vdxf-keys.ts` | Move (DD_KEY extracted) |
| `app/game/page.tsx` | `app/[gameType]/offline/page.tsx` | Move + generalize |
| `app/games/page.tsx` | `app/[gameType]/games/page.tsx` | Move + generalize |
| `app/games/GameList.tsx` | `app/[gameType]/games/GameList.tsx` | Move + parameterize |
| `app/games/actions.ts` | `app/[gameType]/games/actions.ts` | Move + player1/player2 |
| — | `app/utils/data-descriptor.ts` | New: DD_KEY + dd() |
| — | `app/games/types.ts` | New: GameConfig interfaces |
| — | `app/games/registry.ts` | New: game registry |
| — | `app/games/checkers/*` | New: all checkers files |

**API routes (updated in-place, not moved):** All routes under `app/api/` stay at their current paths. Changes are field renames (`whitePlayer` → `player1`, `blackPlayer` → `player2`, `whitePlayerId` → `player1Id`, `blackPlayerId` → `player2Id`) and adding `gameType` awareness. See the API routes table below for per-route details.

**Chess-specific strings to replace in shared components:**
- `GameOver.tsx`: `session?.whiteFinalSig` → `session?.player1FinalSig`, `session?.blackFinalSig` → `session?.player2FinalSig`, `"White:"` / `"Black:"` labels → `gameConfig.player1Label` / `gameConfig.player2Label`, hardcoded `.ChessGame@` → `gameConfig.parentIdentityName`
- `GameList.tsx`: `"White:"` / `"Black:"` / `"White Sig:"` / `"Black Sig:"` labels → config labels, `.ChessGame@` → config identity name, local `OnChainGame` interface fields → `player1`/`player2` naming, `MoveList` component → use `gameConfig.formatMoveForDisplay()`

### Database Schema

```prisma
model Game {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  gameType  String   @default("chess")

  player1       User     @relation("Player1", fields: [player1Id], references: [id])
  player1Id     String
  player2       User     @relation("Player2", fields: [player2Id], references: [id])
  player2Id     String

  boardState Json
  status     String   @default("IN_PROGRESS")
  winner     String?  // player cuid of winner, null for in-progress, null for draw
  mode       String   @default("original")
  boardTheme String   @default("classic")
  logoMode   String   @default("off")

  blockchainTxId      String?
  blockchainVdxfKey   String?
  blockchainStoredAt  DateTime?

  moves Move[]
  gameSession GameSession?
}

model User {
  id          String   @id @default(cuid())
  verusId     String   @unique
  displayName String?
  avatarUrl   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  gamesAsPlayer1 Game[] @relation("Player1")
  gamesAsPlayer2 Game[] @relation("Player2")
}

model GameSession {
  id                String    @id @default(cuid())
  game              Game      @relation(fields: [gameId], references: [id])
  gameId            String    @unique
  subIdName         String?
  subIdAddress      String?
  gameHash          String?
  player1FinalSig   String?
  player2FinalSig   String?
  player1OpeningSig String?
  player2OpeningSig String?
  verifiedAt        DateTime?
  storedAt          DateTime?
  txId              String?
  createdAt         DateTime  @default(now())
}

model GameCounter {
  id        String  @id        // 'chess', 'checkers' (was 'singleton')
  nextGame  Int     @default(1)
}

model SubIdPool {
  id          String   @id @default(cuid())
  gameType    String   @default("chess")  // NEW: scopes pool entries per game type
  subIdName   String   @unique
  gameNumber  Int
  address     String?
  status      String   @default("registering")
  commitTxId  String?
  createdAt   DateTime @default(now())
  usedAt      DateTime?
  usedByGameId String?

  @@unique([gameType, gameNumber])  // unique per game type
}

// Move, ProcessedChallenge — unchanged
```

**Winner column:** Keeps storing the winning player's cuid (e.g., `clwx7abc...`). This preserves leaderboard queries (`WHERE winner = user.id`) without any data migration for existing records. The `endGame()` action changes its parameter from `'OUR' | 'OPPONENT' | 'DRAW'` to `1 | 2 | 'DRAW'` and resolves the cuid from `player1Id` or `player2Id`.

**Migration strategy:** On testnet, the simplest path is `npx prisma db push --force-reset` since the DB can be rebuilt. For safety, the migration script should:
1. `ALTER TABLE Game RENAME COLUMN whitePlayerId TO player1Id`
2. `ALTER TABLE Game RENAME COLUMN blackPlayerId TO player2Id`
3. `ALTER TABLE GameSession RENAME COLUMN whiteFinalSig TO player1FinalSig` (and 3 more)
4. `ALTER TABLE GameCounter UPDATE id = 'chess' WHERE id = 'singleton'`
5. `ALTER TABLE SubIdPool ADD COLUMN gameType TEXT DEFAULT 'chess'`
6. Add `gameType` column to Game with default `'chess'`

No winner value migration needed since cuids are preserved.

### Shared Engine Changes

Every function that previously read `CHESSGAME_*` env vars now receives values from a game config lookup.

**verus-rpc.ts:**
- `buildSubIdFullName(subIdName, parentIdentityName)` — explicit parent parameter

**game-counter.ts:**
- `nextGameNumber(gameType, prefix)` — per-game-type counter rows, prefix for SubID naming

**hash-chain.ts:**
- `computeAnchorHash(subIdName, player1, player2)` — parameter names change but the internal JSON object preserves `{ subIdName, white: player1, black: player2, startPos: 'standard' }` field names so existing hash chains remain verifiable
- `verifyChain(subIdName, player1, player2, packages)` — same: params renamed, internal field names preserved
- All hashing logic identical

**Mode handlers (normal, showcase):**
- Look up `getGameConfig(game.gameType)` for identity config and VDXF keys
- Pass config values to `subid-storage` and `verus-rpc` functions
- When `chainEnabled === false`: `storeOnChain` returns `{ success: false, error: 'Chain storage not available' }`, `onGameEnd` still computes and verifies the hash chain (integrity is valuable even without chain storage)
- Handler structure unchanged

**subid-storage.ts:**
- `storeGameData(subIdName, gameData, keys, parentIdentityAddress)` — accepts VDXFKeySet and parent address as parameters
- Maps `gameData.player1Name` → `keys.player1.vdxfid`, `gameData.player1Sig` → `keys.player1sig.vdxfid`, etc.

**chain-reader.ts:**
- `readGameFromChain(subIdName, gameType)` — loads VDXFKeySet from game config
- `listGamesFromChain(gameType)` — scopes to correct parent identity and counter
- `OnChainGame` interface uses `player1`/`player2` field names (see Updated Shared Interfaces above)

**subid-pool.ts:**
- `popReadySubId(gameType)` — filters by `gameType` column
- `ensurePoolSize(gameType, config)` — creates entries with the correct `gameType` and uses config's parent identity
- `registerOneSubId(entry, config)` — uses config's parent identity address and signing WIF

**data-descriptor.ts (new file):**
- `DD_KEY` and `dd()` extracted from `vdxf-keys.ts` since VDXF keys are moving into per-game directories

### Routing & Pages

**Game pages** — game type resolved from DB:
- `/game/[gameId]` — fetches game record, reads `game.gameType`, loads board component from registry
- `GameClient.tsx` becomes a thin shell: shared logic (socket, mode handling, signing, rematch) + dynamic `BoardComponent` and `SidebarComponent` from config

**Browsing pages** — prefixed by game type:
- `/[gameType]/games` — on-chain game list for one game type
- `/[gameType]/offline` — local game for one game type, loads `config.createInitialState()` and `config.BoardComponent`

**API routes — all updated for player1/player2 naming:**

| Route | Changes |
|---|---|
| `POST /api/game` | Accepts `gameType`, uses `gameConfig.createInitialState()` instead of chess `initialPieces`, stores `gameType` in DB |
| `GET /api/game/[gameId]` | Prisma includes `player1`/`player2` (was `whitePlayer`/`blackPlayer`) |
| `PATCH /api/game/[gameId]` | Same relation rename |
| `POST /api/game/[gameId]/store-blockchain` | Loads game config from `game.gameType`, passes to handler. Returns error if `chainEnabled === false` |
| `POST /api/game/[gameId]/verify` | Loads game config, passes player1/player2 verusIds to verifyChain |
| `POST /api/game/[gameId]/showcase-sign` | Uses `player1Id`/`player2Id`, `player1OpeningSig`/`player2OpeningSig` |
| `GET /api/games` | Adds `gameType` filter to Prisma query, includes `player1`/`player2` |
| `GET /api/chain/games` | Accepts `?gameType=` query param |
| `GET /api/leaderboard` | Unchanged — still queries `WHERE winner = user.id` since winner stores cuids |
| `POST /api/game/[gameId]/store-move-blockchain` | Early return for non-original modes (unchanged), chainEnabled guard added |

**Server actions — `app/game/[gameId]/actions.ts`:**
- `getGame()`: includes `player1`/`player2` (was `whitePlayer`/`blackPlayer`)
- `updateGame()`: resolves `moveInfo.player` against `player1Id`/`player2Id` (was `whitePlayerId`/`blackPlayerId`)
- `endGame()`: parameter changes from `'OUR' | 'OPPONENT' | 'DRAW'` to `1 | 2 | 'DRAW'`, resolves winner cuid from `player1Id`/`player2Id`

**Sidebar navigation — `lib/constants.ts`:**
- Generated from `getAllGameTypes()` instead of hardcoded links
- Each game type gets an on-chain games link and an offline link
- Dashboard, Challenge Players, Chat, Settings links unchanged

### Challenge Flow

**ChallengeModal** — game type is the first selection:
- Game type buttons at top (from `getAllGameTypes()`)
- Mode picker below (showcase greyed out with tooltip if `chainEnabled: false`)
- Theme picker filtered by selected game's `themeMode`
- MiniBoard preview adapts to selected game type

**Socket events** — `gameType` added to payloads:
- `challenge-user`: includes `gameType`
- `start-game`: passes `gameType` to `/api/game`
- `game-started`: includes `gameType`
- `rematch-offer/accept`: carries `gameType` from original game, server fetches original game's `gameType` column
- `move-made`: unchanged (already generic)

**server.js changes (detailed — untyped JS, precision matters):**
- `challenge-user` handler: accept `gameType` from payload, store it in the `pendingChallenges` entry, relay it in `new-challenge` emit to target
- `start-game` handler: read `gameType` from payload, pass it in POST body to `/api/game` alongside `player1Id`/`player2Id` (was `whitePlayerId`/`blackPlayerId`), `mode`, `boardTheme`, `logoMode`
- `rematch-accept` handler: fetch original game from `/api/game/[gameId]`, extract `gameType`, pass it in POST body to create new game. Player fields in request body become `player1Id`/`player2Id`
- `pendingChallenges` array entries: add `gameType` field
- `game-started` emit: include `gameType` so clients know which board to load
- All `POST /api/game` calls in server.js: change `whitePlayerId`/`blackPlayerId` fields to `player1Id`/`player2Id` in request body

**ChallengeContext** — `Challenge` interface gets a `gameType` field

**ChallengeInbox** — shows game icon and display name from config alongside challenge details

**SocketRegistration** — rename `(window as any).__chessSocket` to `(window as any).__gameSocket`

### Chain-Disabled Game Behavior

When a game's config has `chainEnabled: false`:

1. **ChallengeModal** — showcase mode greyed out with tooltip. Normal mode available (hash chain still works for integrity, just no chain storage).
2. **Game creation** — no SubID assigned, no fire-and-forget commitment
3. **During game** — hash chain computed per-move (for integrity even without chain). `GameMoves` component skips blockchain calls. `SubIdStatus` component hidden.
4. **Game end** — `onGameEnd` runs chain verification (returns verified result). `storeOnChain` returns `{ success: false, error: 'Chain storage not available for this game type' }`. `GameOver` component hides the blockchain signing/storage section (uses `gameConfig.chainEnabled` check, similar to existing `hasChainSupport` flag).
5. **On-chain games page** — `/checkers/games` shows empty state with message "Chain storage not yet available for Checkers."

### Checkers Implementation (Stub)

Board: 8x8 grid, 12 pieces per player on dark squares. Uses shared grid themes.

Rules:
- Regular pieces move diagonally forward one square
- Captures by jumping diagonally over opponent piece
- Forced jumps (must capture if possible)
- Multi-jump chains
- Kinging when reaching opposite back row
- Kings move diagonally forward or backward
- Win by capturing all opponent pieces or blocking all moves

Move notation: coordinate-based, e.g., `c3b4` (move) or `c3a5` (jump)

Components:
- `Board.tsx` — 8x8 grid, circular pieces (red/black), crown indicator for kings, valid move highlights, same CSS variable theming as chess
- `Board.css` — checker piece styling, king crown overlay
- `Sidebar.tsx` — captured pieces count per player
- `rules.ts` — forced jump detection, multi-jump chains, kinging
- `models/` — CheckerPiece (position, team, isKing)

Config:
- `chainEnabled: false` (until `CheckersGame@` is funded and VDXF keys registered)
- `themeMode: 'grid'` (shares chess themes)
- `player1Label: 'Red'`, `player2Label: 'Black'`
- `subIdPrefix: 'checkers-game'`
- `vdxf-keys.ts` — placeholder URIs (`checkersgame::game.v1.*`), empty i-addresses until registered via `getvdxfid`

### What Does NOT Change

- Prisma/SQLite infrastructure (provider, connection)
- JWT authentication and middleware
- Socket.IO server structure (port 3002)
- Theme system (`board-themes.ts`)
- Logo watermark system
- Accept-while-busy challenge flow logic
- Move model schema
- ProcessedChallenge model schema
- Hash chain cryptographic logic (only param names change, hash outputs identical)
- Mode resolver dispatch logic
- Move signer
