# Verus Game Arena — Developer Guide

## What This Is

A Next.js 14 multi-game platform with real-time multiplayer, VerusID authentication, and Verus blockchain game storage. Initially chess-only, it now supports multiple game types (chess, checkers) via a pluggable game registry. Games are played in the browser, moves are hash-chained for integrity, and completed games are stored on-chain as SubIDs under a per-game-type parent identity (e.g., `ChessGame@`, `CheckersGame@`).

## Quick Start

```bash
yarn install
npx prisma db push          # Create/sync SQLite DB
npx prisma generate         # Generate Prisma client
cp .env.example .env        # Fill in your Verus RPC credentials
node server.js &            # Socket.IO on :3002
npx next dev                # Next.js on :3000
```

Requires a running Verus testnet daemon (`verusd -chain=VRSCTEST`) with RPC enabled.

## Architecture

```
Browser ──→ Next.js API Routes ──→ Mode Handlers ──→ Verus RPC (blockchain)
   ↕              ↕                      ↕
Socket.IO      Prisma/SQLite        Shared Utilities
(:3002)          (dev.db)          (verus-rpc.ts, etc.)
```

### Key directories

```
app/games/
├── types.ts               # GameConfig interface + GameType union
├── registry.ts            # GAME_REGISTRY map — all registered game types
├── chess/                 # Chess implementation
│   ├── config.ts          # GameConfig for chess (identity, VDXF keys, labels)
│   ├── Board.tsx          # Chess board renderer
│   ├── rules.ts           # Move validation, legal moves, game-over detection
│   ├── vdxf-keys.ts       # Chess-specific VDXF key constants
│   └── models/            # Chess piece/state models
└── checkers/              # Checkers implementation
    ├── config.ts          # GameConfig for checkers
    ├── Board.tsx          # Checkers board renderer
    ├── rules.ts           # Checkers move validation
    └── models/            # Checkers state models

app/utils/
├── verus-rpc.ts          # rpcCall, waitForConfirmation, buildSubIdFullName, getPlayerName
├── data-descriptor.ts    # dd() helper — wraps values in VDXF DataDescriptor format
├── game-counter.ts       # nextGameNumber(gameType) — atomic per-game-type counter
├── subid-pool.ts         # Pre-registered SubID pool for showcase mode
├── board-themes.ts       # 10 board color themes, LogoMode type, validators
├── chain-reader.ts       # Read game data from on-chain SubIDs
└── modes/
    ├── types.ts           # ModeHandler interface
    ├── mode-resolver.ts   # getModeHandler(mode) dispatch
    ├── normal/            # Normal mode (hash chain + end-of-game storage)
    ├── showcase/          # Showcase mode (per-move on-chain + player signatures)
    └── original/          # Legacy mode (passthrough to BlockchainStorage.js)

components/game/
├── ChallengeModal.tsx     # Challenge config popup (mode + theme + logo picker, game type)
├── GameOver.tsx           # End-of-game UI with signing flow
├── GameMoves.tsx          # Move history panel
├── SubIdStatus.tsx        # SubID assignment indicator
├── ShowcaseSigningPrompt.tsx # Player signing prompt for showcase mode
└── BlockchainInfoDialog.tsx  # On-chain storage info dialog

components/dashboard/
├── ChallengeContext.tsx   # React Context for challenge state (persists across pages)
├── ChallengeInbox.tsx     # Navbar dropdown: incoming/sent challenges, status dots
├── DashboardLayout.tsx    # SideNav + Navbar wrapper
└── SocketRegistration.tsx # Global Socket.IO connection, feeds ChallengeContext
```

## Game Modes

The app supports pluggable game modes via the `ModeHandler` interface:

```typescript
interface ModeHandler {
  onMove(game, moveData): Promise<SignedMovePackage | null>;
  onGameEnd(game): Promise<GameEndResult | null>;
  storeOnChain(game): Promise<StorageResult>;
}
```

| Mode | When data goes on-chain | Player signatures | SubID pool |
|------|------------------------|-------------------|------------|
| **normal** | At game end | Closing sigs on gameHash | No (fire-and-forget commitment) |
| **showcase** | Every move + game end | Opening + closing sigs | Yes (pre-registered) |
| **original** | At game end (legacy) | None | No |

### Adding a New Mode

1. Create `app/utils/modes/<yourmode>/handler.ts` implementing `ModeHandler`
2. Add a case to `mode-resolver.ts`:
   ```typescript
   case 'yourmode':
     return yourModeHandler;
   ```
3. Update `prisma/schema.prisma` Game.mode comment
4. Add mode option to `ChallengeModal.tsx` mode picker buttons

Use shared utilities — don't duplicate:
- `rpcCall()`, `buildSubIdFullName()`, `getPlayerName()` from `app/utils/verus-rpc.ts`
- `nextGameNumber()` from `app/utils/game-counter.ts`
- `CHESS_VDXF_KEYS`, `DD_KEY`, `dd()` from `app/utils/modes/normal/vdxf-keys.ts`
- `hashMovePackage()`, `verifyChain()`, `computeGameHash()` from `app/utils/modes/normal/hash-chain.ts`

### Adding a New Game

1. Create `app/games/<yourtype>/` with at minimum:
   - `config.ts` — implements the `GameConfig` interface (identity name, VDXF keys, display name, etc.)
   - `Board.tsx` — React board component (receives `gameState`, `onMove`, `boardTheme`, `logoMode`)
   - `rules.ts` — move validation, legal move generation, game-over detection
   - `types.ts` — game-specific state types
   - `vdxf-keys.ts` — VDXF key constants for on-chain storage
2. Implement the `GameConfig` interface from `app/games/types.ts`
3. Register in `app/games/registry.ts`:
   ```typescript
   import { yourConfig } from './yourtype/config';
   export const GAME_REGISTRY = { chess: chessConfig, yourtype: yourConfig };
   ```
4. Add parent identity env vars (see Environment Variables section)
5. Register VDXF keys on the daemon:
   ```bash
   verus -chain=VRSCTEST definedatastream '{"name":"yourtype::game.v1.player1","systemid":"..."}'
   ```
6. Add `<yourtype>GameCounter` seed in `prisma/schema.prisma` GameCounter model comment

### Routes That Must Be Mode-Aware

When adding a new mode, check these routes for mode gating:

| Route | What it does | Mode check location |
|-------|-------------|-------------------|
| `app/api/game/route.ts` | Game creation + SubID assignment | `if (gameMode === 'normal')` / `else if (gameMode === 'showcase')` |
| `app/api/game/[gameId]/store-blockchain/route.ts` | End-of-game storage | `if (mode === 'normal' \|\| mode === 'showcase')` |
| `app/api/game/[gameId]/store-move-blockchain/route.ts` | Per-move storage (legacy) | Early return for non-original modes |
| `app/api/game/[gameId]/verify/route.ts` | Hash chain verification | `if (mode !== 'normal' && mode !== 'showcase')` |
| `app/api/game/[gameId]/showcase-sign/route.ts` | Player signatures | Accepts `normal` and `showcase` |
| `components/chessboard/SubIdStatus.tsx` | SubID indicator | `mode !== 'normal' && mode !== 'showcase'` |
| `components/chessboard/GameOver.tsx` | End-of-game UI | `hasChainSupport = isShowcase \|\| isNormal` |

## On-Chain Data Format

Each game is a SubID under `ChessGame@` (e.g., `game0017.ChessGame@`).

Data is stored in `contentmultimap` using VDXF keys wrapped in DataDescriptors:

```
chessgame::game.v1.white     → "zenny@"
chessgame::game.v1.black     → "lenny@"
chessgame::game.v1.moves     → ["e2e4","e7e5","d1h5","a7a6","h5f7"]
chessgame::game.v1.winner    → "zenny@"
chessgame::game.v1.gamehash  → "217b6796c7202d3f..."
chessgame::game.v1.whitesig  → <player signature on gameHash>
chessgame::game.v1.blacksig  → <player signature on gameHash>
chessgame::game.v1.mode      → "showcase"
... (17 keys total, see vdxf-keys.ts)
```

DataDescriptor format: `{ [DD_KEY]: { version: 1, mimetype, objectdata: { message: value }, label } }`

## Hash Chain

Ensures move integrity without trusting the server:

1. **Anchor hash**: `SHA256(subIdName + white + black + "standard")` — binds chain to game identity
2. **Each move**: `SHA256(JSON.stringify(movePackage))` where movePackage includes prevHash
3. **Game hash**: SHA256 of the final move package — both players sign this

Verification: `verifyChain(subIdName, white, black, movePackages)` returns `{ valid, error? }`.

## SubID Pool (Showcase Mode)

Showcase mode needs SubIDs confirmed on-chain before the first move. The pool pre-registers them:

```
Pool lifecycle: registering → ready → used
                     ↓ (on failure)
                   failed → (retry on next ensurePoolSize)
```

- `GET /api/pool` — pool status (public)
- `POST /api/pool` — trigger replenishment (requires `x-api-secret` header in production)
- `SUBID_POOL_ENABLED=false` disables the pool entirely
- Pool only used for showcase mode; normal mode uses fire-and-forget commitment

## Environment Variables

See `.env.example` for all variables. Critical ones:

| Variable | Purpose |
|----------|---------|
| `VERUS_RPC_*` | Daemon connection (user, password, host, port) |
| `CHESSGAME_IDENTITY_NAME` | Chess parent identity (default: `ChessGame@`) |
| `CHESSGAME_IDENTITY_ADDRESS` | Chess parent i-address |
| `CHESSGAME_SIGNING_WIF` | Private key for chess SubID operations |
| `CHECKERSGAME_IDENTITY_NAME` | Checkers parent identity (default: `CheckersGame@`) |
| `CHECKERSGAME_IDENTITY_ADDRESS` | Checkers parent i-address |
| `CHECKERSGAME_SIGNING_WIF` | Private key for checkers SubID operations |
| `SUBID_POOL_ENABLED` | Pool toggle (default: true) |
| `INTERNAL_API_SECRET` | Shared secret for server.js → Next.js internal calls |

## Database

SQLite via Prisma. Key models:

- **Game** — `gameType` (e.g., `"chess"`, `"checkers"`), `player1Id`/`player2Id` (VerusID strings, not color-specific), board state, status, mode, boardTheme, logoMode, blockchain tx tracking
- **GameSession** — SubID assignment, hash chain results, player signatures (opening + closing)
- **Move** — individual moves with signed packages
- **SubIdPool** — pre-registered SubIDs per `gameType`; `subIdName` is namespaced (e.g., `"chess-game0017"`)
- **GameCounter** — per-game-type counter; `id` is the game type string (e.g., `"chess"`, `"checkers"`)

## Board Themes

10 color themes defined in `app/utils/board-themes.ts`. Chessboard uses CSS custom properties (`--square-light`, `--square-dark`). Verus logo watermark overlay with 3 modes (off/faded/centered). Challenger picks theme in `ChallengeModal` popup. Stored in Game DB columns `boardTheme` and `logoMode`.

## Challenge Inbox

Global challenge notification system in the Navbar (bell icon with badge). Lives in root layout (`app/layout.tsx`) via `ChallengeProvider` + `SocketRegistration` so it persists across all pages.

Key architecture:
- `ChallengeContext.tsx` — React Context stores challenge state
- `SocketRegistration.tsx` — feeds socket events into context
- `ChallengeInbox.tsx` — dropdown UI with status dots and actions
- Pages use `getGlobalSocket()` to emit, window CustomEvents to communicate with context
- Server tracks `userGameStatus` (available/in-game) and `pendingChallenges` array

Accept-while-busy flow: if challenger is in-game, acceptor sends `challenge-accepted-busy` → challenger gets `ready-to-play` notification → either side can `start-game` when both available.

## Socket.IO Events

`server.js` runs independently on port 3002. Key events:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `register-user` | Client → Server | Associate userId with socket |
| `challenge-user` | Client → Server | Send game challenge (includes `gameType`, mode, boardTheme, logoMode) |
| `challenge-cancel` | Client → Server | Cancel a sent challenge |
| `challenge-accepted-busy` | Client → Server | Accept while challenger is in-game (includes `gameType`) |
| `start-game` | Client → Server | Both ready — server creates game (includes `gameType`) |
| `new-challenge` | Server → Client | Relay challenge with challengerStatus and `gameType` |
| `challenge-cancelled` | Server → Client | Challenge was cancelled |
| `ready-to-play` | Server → Client | Opponent accepted your challenge |
| `user-status-changed` | Server → Client | User's game status changed |
| `game-started` | Server → Client | Game created, redirect both players (includes `gameType`) |
| `move-made` | Client → Server | Relay board state + signed package |
| `leave-game` | Client → Server | Notify opponent of departure |
| `rematch-offer/accept` | Bidirectional | Rematch flow (carries over `gameType`, mode + theme, randomizes colors) |

## Known Limitations

1. `blockchain-move-storage-basic.js` has a broken import — original mode per-move storage will crash
2. Player signing is via CLI `verus signmessage` — no browser wallet integration yet
3. SQLite-specific `INSERT OR IGNORE` in game-counter.ts — needs change for PostgreSQL
4. Auto-store unsigned games not yet implemented (if neither player signs, game stays local only)
