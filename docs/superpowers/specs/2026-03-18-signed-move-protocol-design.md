# Signed Move Protocol — Design Spec

## Overview

Redesign the chess app's Verus blockchain integration to use a cryptographically signed move protocol with per-game SubIDs. The existing implementation is preserved as "Original" mode. The new protocol ships as "Normal" mode. The architecture supports future modes (Tournament, third-party) via a pluggable mode system.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Frontend (unchanged)             │
│   Chessboard / GameClient / Models / Rules       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              API Routes + Socket.IO              │
│         (modified to detect game mode)           │
└──────────────────────┬──────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Mode Resolver  │
              └───┬────┬────┬───┘
                  │    │    │
         ┌────────▼┐ ┌▼────▼──────┐ ┌────────────┐
         │Original │ │ Normal     │ │ Tournament │
         │ Mode    │ │ Mode       │ │ Mode       │ ← future
         │(as-is)  │ │ (new)      │ │            │
         └─────────┘ └─────┬─────┘ └────────────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
          ┌─────▼───┐ ┌───▼───┐ ┌───▼────────┐
          │  Move   │ │ Hash  │ │  SubID     │
          │  Signer │ │ Chain │ │  Storage   │
          └─────────┘ └───────┘ └────────────┘
               ▲
               │ (pluggable)
               ├── Server signing (now)
               ├── Browser extension (future)
               └── VerusMobile (future)
```

### Key Principles

- API routes stay thin — resolve game mode, delegate to handler
- Each mode handler owns signing, verification, and storage logic
- The signer is pluggable — swap server-signing for client-signing later without touching mode handlers
- Frontend doesn't know or care about modes
- Existing code preserved as "Original" mode — nothing deleted
- Follow existing codebase voice and patterns throughout

---

## Mode System

### Mode Resolver

Detects the game's mode and returns the appropriate handler. API routes call the resolver instead of interacting with blockchain code directly.

```ts
// app/utils/modes/mode-resolver.ts
import { originalHandler } from './original/handler';
import { normalHandler } from './normal/handler';

export interface ModeHandler {
  onMove(game: Game, moveData: MoveData): Promise<SignedMovePackage>;
  onGameEnd(game: Game): Promise<GameEndResult>;
  storeOnChain(game: Game): Promise<StorageResult>;
}

export function getModeHandler(mode: string): ModeHandler {
  switch (mode) {
    case 'normal':
      return normalHandler;
    case 'original':
    default:
      return originalHandler;
  }
}
```

### Handler Interface

Each mode handler implements the `ModeHandler` interface:

```ts
handler.onMove(game, moveData)     // called after each move
handler.onGameEnd(game)            // called when game completes
handler.storeOnChain(game)         // called to persist to blockchain
```

### Modes

| Mode | Description | Status |
|------|-------------|--------|
| Original | Current implementation. Single signing identity, post-game storage, `BlockchainStorage` class | Existing — wrapped as mode handler |
| Normal | Signed move protocol, SubID per game, hash chain, 2 final signatures | New — this spec |
| Tournament | TBD — brackets, entry fees, tournament-level SubIDs | Future |

---

## Signed Move Protocol (Normal Mode)

### Move Package Format

Each move produces a signed package:

```json
{
  "subIdName": "game0001",
  "player":    "alice@",
  "moveNum":   3,
  "move":      "e2e4",
  "prevHash":  "a3f8c1..."
}
```

- `subIdName`: SubID name for this game (e.g., `game0001` → `game0001.chessgame@`)
- `player`: VerusID of the player making the move
- `moveNum`: Sequential move number (1-indexed)
- `move`: Move in UCI notation — 4 characters for normal moves (`e2e4`), 5 characters for promotions (`e7e8q`). The frontend sends moves as `{from, to, promotion?}` objects; the API route converts to UCI format before passing to the mode handler.
- `prevHash`: SHA256 hash of the previous move package. Creates a tamper-proof hash chain.

### First Move

`prevHash` for move 1 = SHA256 of the initial game state:

```json
{
  "subIdName": "game0001",
  "white":     "alice@",
  "black":     "bob@",
  "startPos":  "standard"
}
```

This anchors the hash chain to the specific game and players.

### Signing

**Current (server-signing):** The chess app server signs each move package using the `CHESSGAME_SIGNING_WIF` key on behalf of the authenticated player. The player is authenticated via VerusID login (existing flow). In Phase 1, both `whiteSig` and `blackSig` on the final game record are server-attestation signatures from the same key — they attest that the server verified the authenticated player made each move. They are not yet cryptographically distinguishable by player.

**Future (client-signing):** The player signs the move package directly via browser extension or mobile wallet. The signing interface is pluggable — the move package format and verification logic are identical regardless of who signs. In Phase 2+, `whiteSig` and `blackSig` become distinct signatures from each player's own key.

### Move Format Conversion

The frontend sends moves as `{from, to, promotion?}` objects (e.g., `{from: "e2", to: "e4"}`). The API route converts to UCI notation before passing to the mode handler:
- Normal moves: `"e2e4"` (4 characters)
- Promotions: `"e7e8q"` (5 characters — appended piece: q/r/b/n)

This conversion happens in the API route layer, not inside the mode handler, so all handlers receive a consistent format.

### prevHash Computation

`prevHash` is computed **server-side** from the previous signed move package stored in the DB. The client does not send `prevHash` — the server is the source of truth for the hash chain. When client-side signing arrives, the client will compute `prevHash` locally and the server will verify it matches.

### Per-Move Flow

```
Player A's turn:
1. Player A makes move in UI
2. Server constructs move package
3. Server signs package with game session key
4. Signed package saved to DB (move + signature)
5. Signed package sent to Player B via Socket.IO

Player B receives:
6. Verify signature
7. Verify prevHash matches local chain
8. Update board
9. Player B's turn — repeat in reverse
```

### Game Over Flow

```
1. Checkmate/stalemate/resignation detected
2. Server computes final gameHash (hash of last move package)
3. Server signs gameHash on behalf of both players
4. Server verifies entire move chain:
   - All hashes are correct (chain integrity)
   - All signatures are valid
   - All moves are legal (re-validate with chess rules)
5. Server creates SubID: game0001.chessgame@
6. Server updates SubID contentmultimap with final game data
7. Per-move signature log stays in DB as audit trail
```

### Failure and Recovery

The game-end flow has multiple sequential steps. If a step fails mid-way:

1. **Hash/signature computation fails**: No side effects. Retry safely.
2. **Verification fails** (invalid chain or illegal move): Game is flagged as `verificationFailed` in `GameSession`. Do not create SubID. Log the discrepancy for investigation.
3. **SubID creation succeeds but contentmultimap update fails**: The `GameSession.subIdAddress` is set but `storedAt` is null. On retry, check if SubID exists and skip creation, proceed to contentmultimap update.
4. **SubID creation fails**: `GameSession.subIdName` is assigned but `subIdAddress` is null. Retry creates the SubID.

The `GameSession` fields serve as a progress checkpoint — each step updates a field so the system knows where to resume on retry. No separate `PROCESSING` lock is needed since `GameSession` state is sufficient.

---

## Data Layer

### Database Schema Changes

**Game model — add field:**

```prisma
mode  String  @default("original")  // "original", "normal", "tournament"
```

**Move model — add fields:**

```prisma
movePackage   Json?     // full signed package {subIdName, player, moveNum, move, prevHash}
signature     String?   // signature for this move
```

**New GameSession model:**

```prisma
model GameSession {
  id              String    @id @default(cuid())
  game            Game      @relation(fields: [gameId], references: [id])
  gameId          String    @unique
  subIdName       String?   // "game0001" — null until SubID created
  subIdAddress    String?   // i-address of the SubID once created
  gameHash        String?   // final SHA256 hash chain result
  whiteFinalSig   String?   // white's signature on gameHash
  blackFinalSig   String?   // black's signature on gameHash
  verifiedAt      DateTime? // when server verified all moves + sigs
  storedAt        DateTime? // when written to chain
  txId            String?   // blockchain tx ID
  createdAt       DateTime  @default(now())
}
```

**New GameCounter model:**

```prisma
model GameCounter {
  id        String  @id @default("singleton")
  nextGame  Int     @default(1)
}
```

Atomic increment on game creation. Zero-padded to 4 digits for SubID name.

```ts
// Atomic increment pattern for SQLite:
const counter = await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = 'singleton'`;
  const result = await tx.gameCounter.findUnique({ where: { id: 'singleton' } });
  return result!.nextGame;
});
const subIdName = `game${String(counter).padStart(4, '0')}`;
```

### On-Chain Data

Stored in `game0001.chessgame@` contentmultimap after game completion:

```
white:       "alice@"
black:       "bob@"
winner:      "alice@"
result:      "checkmate"         (checkmate/stalemate/resignation/timeout)
moves:       ["e2e4", "e7e5", ...]
moveCount:   42
duration:    1830                (seconds)
startedAt:   1710765600          (unix timestamp)
gameHash:    "a3f8c1..."         (SHA256 of full move chain)
whiteSig:    <signature>         (white signs final gameHash)
blackSig:    <signature>         (black signs final gameHash)
```

### Off-Chain Data (DB only)

- Per-move signed packages + individual signatures (audit trail)
- Full board state JSON (for game replay without re-computation)

### Player Self-Storage Format (designed now, implemented later)

When client-side signing is available, players can write game records to their own identity:

```
// On alice@'s identity:
chess.game0001: {
  opponent:  "bob@"
  result:    "win"
  gameId:    "game0001.chessgame@"
  gameHash:  "a3f8c1..."
}
```

This is a future feature gated on client-side signing capability.

---

## SubID Structure

### Parent Identity

`ChessGame@` — created and managed by the user outside of this codebase. The app receives its credentials via environment variables.

### Per-Game SubIDs

- Named sequentially: `game0001.chessgame@`, `game0002.chessgame@`, ...
- Created by the chess app server before game starts (or at game end — see open question below)
- Funded by `ChessGame@`
- Contentmultimap updated with final game data after completion + verification

### SubID Creation Timing

**Option A: Before game starts** — SubID exists from the start, game is "registered" on-chain immediately. Costs VRSC even if game is abandoned.

**Option B: After game ends** — SubID created only for completed games. No wasted VRSC on abandoned games. Slight delay at game end for SubID creation + data storage.

Recommendation: **Option B** — create SubID at game end to avoid paying for abandoned/aborted games.

---

## File Structure

### New Files

```
app/utils/modes/
  ├── mode-resolver.ts           — detects game mode, returns ModeHandler
  ├── types.ts                   — ModeHandler interface and shared types
  ├── original/
  │   └── handler.ts             — wraps existing BlockchainStorage code
  └── normal/
      ├── handler.ts             — orchestrates the normal mode flow
      ├── move-signer.ts         — sign/verify move packages (pluggable)
      ├── hash-chain.ts          — prevHash computation + chain verification
      └── subid-storage.ts       — SubID creation + contentmultimap updates
```

New files use TypeScript to match the existing API routes. The existing JS blockchain files are wrapped, not rewritten.

### Modified Files

```
app/api/game/route.ts                                — add mode field on game creation
app/api/game/[gameId]/move/route.ts                  — delegate to mode handler for signing
app/api/game/[gameId]/store-blockchain/route.ts      — delegate to mode handler for storage
app/api/game/[gameId]/store-move-blockchain/route.ts — mode-aware: Original mode proxies to existing code, Normal mode returns no-op
prisma/schema.prisma                                 — add mode, GameSession, GameCounter, move package fields
server.js                                            — include move packages in socket events
```

### Untouched Files

```
app/utils/verusLogin.js              — VerusID login (unchanged)
app/utils/deeplink.js                — QR code generation (unchanged)
app/utils/blockchain-storage.js      — preserved, wrapped by original mode handler
app/utils/blockchain-move-storage-basic.js — preserved, wrapped by original mode handler
ChessGame.js                         — preserved, used by original mode handler
app/models/*                         — chess game logic (unchanged)
app/referee/*                        — move validation (unchanged)
components/*                         — UI components (unchanged)
```

### Frontend Note

The existing frontend calls `store-move-blockchain` per move. For Normal mode games, this route returns a no-op success response (the mode handler handles move signing through the main `/move` route instead). No frontend changes are needed — the route silently adapts based on game mode.

---

## Environment Variables

### New Variables

```
# ChessGame@ identity (user provides after creating it)
CHESSGAME_IDENTITY_NAME=            # "ChessGame@"
CHESSGAME_IDENTITY_ADDRESS=         # i-address
CHESSGAME_SIGNING_WIF=              # private key for ChessGame@
```

### Existing Variables (unchanged)

```
VERUS_SIGNING_ID=                   # used by "original" mode
VERUS_SIGNING_WIF=                  # used by "original" mode
VERUS_RPC_USER=                     # shared by all modes
VERUS_RPC_PASSWORD=                 # shared by all modes
VERUS_RPC_HOST=                     # shared by all modes
VERUS_RPC_PORT=                     # shared by all modes
TESTNET=                            # shared by all modes
```

### Default Game Mode

New games default to `"normal"` mode. Existing games with no `mode` field resolve to `"original"` via the mode resolver.

---

## Signing Method Roadmap

| Phase | Signer | How |
|-------|--------|-----|
| Phase 1 (now) | Server | Server signs on behalf of authenticated players using `CHESSGAME_SIGNING_WIF` |
| Phase 2 | VerusMobile | Updated mobile wallet signs move packages via deeplink/QR (when available) |
| Phase 3 | Browser extension | Verus MetaMask-style extension injects signer into browser (when available) |
| Phase 4 | Local daemon | Direct RPC to user's local Verus daemon (power users) |

The protocol and on-chain data format are identical across all phases. Only the signing source changes.

---

## Migration Notes

- All new fields on existing models are optional or have defaults — backward-compatible
- Existing games without a `mode` field default to `"original"` at the application layer (mode resolver)
- `prisma db push` is sufficient for development (existing project pattern)
- No backfill migration needed — existing games are implicitly "original" mode
- The `Game` model gains a back-relation to `GameSession` (add `gameSession GameSession?` field)

## Derived Fields

- **`startedAt`**: Derived from `Game.createdAt` (existing field)
- **`duration`**: Computed at game end as `Game.updatedAt - Game.createdAt` (in seconds)
- **VDXF keys**: Use placeholder string keys during development. Replace with proper VDXF key IDs when user provides them after creating `ChessGame@` identity. Placeholder format: `chess.white`, `chess.black`, `chess.winner`, etc.

---

## Open Questions

1. **SubID creation timing**: Spec recommends after game ends (Option B). Confirm.
2. **VDXF key definitions**: Specific VDXF keys for the contentmultimap fields need to be defined. User will provide after creating `ChessGame@` identity + token. Use placeholder string keys during development.
3. **SubID cost on testnet**: Need to verify cost of SubID creation under `ChessGame@` on testnet.
4. **Per-move server-side validation**: Currently all move validation is client-side (`app/referee/rules.ts`). The post-game verification step adds server-side validation at game end. Should the Normal mode handler also validate moves server-side on each `onMove` call? Recommendation: validate per-move server-side to catch invalid moves early rather than only at game end.
