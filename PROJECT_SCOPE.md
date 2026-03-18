# Verus Chess Arena — Full Project Scope

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│    FRONTEND      │     │      API          │     │    DATA / CHAIN     │
│  Next.js 14      │◄───►│  Next.js Routes   │◄───►│  SQLite (Prisma)    │
│  React 18        │     │  Socket.IO :3002  │     │  Verus Blockchain   │
│  Tailwind/Shadcn │     │                    │     │  (RPC interface)    │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, Shadcn/UI |
| State Management | Zustand (sidebar), React useState, localStorage |
| Real-time | Socket.IO (server on port 3002) |
| Database | Prisma ORM with SQLite |
| Blockchain | Verus (RPC interface) |
| Authentication | VerusID (decentralized identity) |

---

## Component 1: Frontend

### Framework & Structure
- **Next.js 14** with App Router (server and client components)
- Root layout at `/app/layout.tsx` with theme provider and responsive design
- Shadcn/UI component library with CSS variable-based theming (dark/light modes)

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing/marketing page |
| `/login` | VerusID QR code login flow |
| `/dashboard` | Game stats, leaderboard, player/game counts |
| `/game/[gameId]` | Active chess game interface |
| `/games` | All games listing |
| `/users` | User directory with challenge capability |
| `/settings` | User configuration |
| `/chat` | Real-time messaging (Socket.IO) |

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| GameClient | `/app/game/[gameId]/GameClient.tsx` | Main game logic handler (595 lines) |
| Chessboard | `/components/chessboard/Chessboard.tsx` | Interactive board with drag/click movement |
| DashboardLayout | `/components/dashboard/` | Main wrapper for authenticated pages |
| Leaderboard | `/components/dashboard/Leaderboard.tsx` | User rankings by wins |
| PromotionDialog | - | Pawn promotion selection |
| GameOver | - | Game result display |
| MoveHistory/GameMoves | - | Move tracking UI |
| Navbar/Sidebar | - | Navigation with theme switcher |

### Chess Game Models

**Board Class** (`/app/models/Board.ts`)
- Manages piece array, turn count, captured pieces
- `calculateAllMoves()` — computes all legal moves for current team
- `checkCurrentTeamMoves()` — validates moves don't leave king in check
- `playMove()` — executes move, handles castling, en passant, promotion
- `shouldPromotePawn()` — detects pawn reaching end rank
- `promotePawn()` — converts pawn to queen/rook/bishop/knight
- `getValidMoves()` — delegates to piece-specific move functions

**Piece Class** (`/app/models/Piece.ts`)
- Properties: position, type, team, hasMoved, possibleMoves
- Team types: `OUR` ('w' = white) or `OPPONENT` ('b' = black)
- Piece types: pawn, rook, knight, bishop, queen, king

**Position Class** (`/app/models/Position.ts`)
- X/Y coordinates (0-7 for 8x8 board)
- Helper methods: samePosition(), withinBoard(), clone()

**Pawn Class** (`/app/models/Pawn.ts`)
- Extends Piece with special enPassant flag

### Move Validation Rules (`/app/referee/rules.ts`)

- `getPossiblePawnMoves()` — forward 1-2 squares, diagonal captures, en passant
- `getPossibleKnightMoves()` — L-shaped moves (8 possibilities)
- `getPossibleBishopMoves()` — diagonal lines until blocked
- `getPossibleRookMoves()` — horizontal/vertical lines until blocked
- `getPossibleQueenMoves()` — combination of rook + bishop
- `getPossibleKingMoves()` — 1 square in any direction
- `getCastlingMoves()` — king-side/queen-side castling logic

---

## Component 2: API Layer

### API Routes

```
/api/
├── login-qr                            — Generate VerusID QR code & deeplink
├── login/verify                        — Verify VerusID login, create JWT
├── login/complete                      — Finalize login with JWT cookie
├── user                                — Get/create user
├── users                               — List all users
├── games                               — List all games
├── game                                — Create new game
├── game/[gameId]                       — Get/update specific game
├── game/[gameId]/move                  — Record move in database
├── game/[gameId]/store-blockchain      — Store completed game on-chain
├── game/[gameId]/store-move-blockchain — Store individual moves on-chain
├── game/[gameId]/move-status           — Check move processing status
└── leaderboard                         — Get user rankings
```

### Key Endpoint Details

**POST /api/login-qr**
- Generates VerusID authentication challenge
- Returns QR code PNG and deeplink for mobile wallet scanning
- Uses `verusid-ts-client` library

**GET/POST /api/login/verify**
- GET: Polls for completed login verification
- POST: Processes VerusID login response
- Creates/updates user in database
- Generates JWT token stored in httpOnly cookie (24h expiry)

**POST /api/game**
- Creates new game between two players
- Initializes board with standard chess starting positions
- Emits Socket.IO `new-game-created` event

**PATCH /api/game/[gameId]**
- Updates game board state, status, or winner
- Used after each move or game completion

**POST /api/game/[gameId]/move**
- Records individual move in Move table
- Updates game's boardState JSON
- Broadcasts via Socket.IO to other player

**POST /api/game/[gameId]/store-blockchain**
- Stores completed game on Verus blockchain
- Creates ChessGame VDXF object
- Signs and broadcasts identity update transaction
- Handles pipelined transaction chaining
- Atomic lock prevents race conditions

### Socket.IO Server (`/server.js` on port 3002)

**Room Management:**
- `joinRoom` — user joins general room (for online player lists)
- `joinGameRoom` — players join game-specific room for move sync
- `userJoined` / `userLeft` — room user list updates

**Challenge System:**
- `register-user` — client registers user socket mapping
- `challenge-user` — Player A challenges Player B
- `new-challenge` — notification to challenged player
- `challenge-accepted` — acceptance triggers game creation
- `challenge-declined` — rejection notification
- `challenge-failed` — no opponent found

**Game Play:**
- `move-made` — broadcasts move data to game room
- `update-board-state` — sends complete board state to opponent
- `opponent-left` — notifies of disconnect (triggers game-over)

**Game Management:**
- `new-game-created` — broadcasts to all clients to refresh
- `leave-game` — player leaves game
- `refresh-game-list` — signal all clients to refresh

**Rematch System:**
- `rematch-offer` / `rematch-offered` / `rematch-accept` / `rematch-confirmed`

**Chat:**
- `sendMessage` / `newMessage` — room-based messaging

---

## Component 3: Data & Blockchain Layer

### Database Schema (Prisma + SQLite)

**User Model**
```
id:          String (CUID)
verusId:     String (unique, blockchain identity)
displayName: String (optional, from blockchain)
avatarUrl:   String (optional)
createdAt:   DateTime
updatedAt:   DateTime
Relations:   gamesAsWhite[], gamesAsBlack[]
```

**Game Model**
```
id:                   String (CUID)
whitePlayer:          User relation
blackPlayer:          User relation
boardState:           Json (entire board state)
status:               String (IN_PROGRESS, COMPLETED, ABORTED)
winner:               String (optional, user ID or null for draw)
moves:                Move[] relation
blockchainTxId:       String (transaction hash or 'PROCESSING')
blockchainVdxfKey:    String (VDXF data key)
blockchainStoredAt:   DateTime
createdAt:            DateTime
updatedAt:            DateTime
```

**Move Model**
```
id:                   String (CUID)
game:                 Game relation
gameId:               String (foreign key)
move:                 String (e.g., "e2e4")
blockchainTxId:       String (optional)
blockchainVdxfKey:    String (optional)
blockchainStoredAt:   DateTime (optional)
createdAt:            DateTime
```

**ProcessedChallenge Model**
```
id:        String (challenge ID)
data:      Json (challenge response data)
createdAt: DateTime
```

### Board State JSON Structure
```json
{
  "pieces": [
    {
      "position": { "x": 0, "y": 0 },
      "type": "rook",
      "team": "w",
      "hasMoved": false,
      "enPassant": false
    }
  ],
  "totalTurns": 5,
  "capturedPieces": [],
  "moves": ["e2e4", "e7e5"],
  "currentTeam": "w",
  "winningTeam": null
}
```

### Verus Blockchain Integration

#### Authentication Flow (VerusID Login)
1. User clicks "Play Now"
2. Frontend calls GET `/api/login-qr`
3. Server creates `LoginConsentChallenge` via `verusid-ts-client`
4. Returns QR code and deeplink
5. User scans with Verus mobile wallet
6. Wallet signs and returns response to `/api/login/verify`
7. Server verifies signature using `VerusId.verifyLoginConsentResponse()`
8. Creates/updates user in database
9. Generates JWT token
10. Redirects to `/login/complete` → sets cookie → redirects to `/dashboard`

#### Game Storage on Blockchain

**ChessGame VDXF Class** (`/ChessGame.js`)
- Custom serialization for compact blockchain storage
- Encodes moves as uint16 pairs (from/to coordinates)
- Calculates SHA256 game hash
- Implements `toCompactBuffer()` for efficient serialization

**Storage Process** (POST `/api/game/[gameId]/store-blockchain`):
1. Game must be COMPLETED
2. Atomic lock: sets `blockchainTxId = 'PROCESSING'`
3. Sanitizes game data (player names, moves, winner, status)
4. Fetches current signing identity from blockchain
5. Creates identity update with game data in `contentmultimap`
6. Queries available UTXOs for identity's primary address
7. Filters out spent/mempool-referenced UTXOs
8. Creates unsigned `updateidentity` transaction
9. Signs with `VERUS_SIGNING_WIF` private key
10. Broadcasts to network via `sendRawTransaction`
11. Returns txId, vdxfKey, game hash; updates database

**Move-Level Storage** (Optional):
- Individual moves stored on-chain via `/api/game/[gameId]/store-move-blockchain`
- Uses `BlockchainMoveStorageBasic` class
- Same VDXF/contentmultimap mechanism per move

#### Key RPC Calls Used
- `getIdentity()` — fetch identity data
- `getAddressUtxos()` — query unspent outputs
- `getAddressMempool()` — check pending transactions
- `sendRawTransaction()` — broadcast signed transaction
- `clearrawmempool()` — retry mechanism on failure
- `updateidentity` — store data in contentmultimap

#### Key Libraries
- `verusid-ts-client` — VerusID authentication
- `verusd-rpc-ts-client` — Verus daemon RPC interface
- `verus-typescript-primitives` — VDXF types and serialization

---

## Verus Blockchain Context (from wiki.autobb.app)

### VerusID (Identity System)
- Human-readable names (e.g., `alice@`) mapped to permanent i-addresses
- Each identity has: primary addresses (rotatable keys), revocation/recovery authorities, and a **contentmultimap** for on-chain data storage
- Supports built-in multisig (n-of-m signing)
- Two-step registration: `registernamecommitment` then `registeridentity`
- Cost: 100 VRSC on mainnet, 100 VRSCTEST on testnet

### VDXF (Verus Data Exchange Format)
- Universal namespaced key-value system for on-chain data
- Keys are deterministic i-addresses derived from URIs like `vrsc::system.agent.profile`
- Generated via `getvdxfid` RPC command
- Values are hex-encoded, always stored as arrays in `contentmultimap`
- Four-stage pipeline: DefinedKey → DataDescriptor → VdxfUniValue → contentmultimap

### On-Chain Data Storage Constraints
- Small data (<5KB): raw hex in contentmultimap (fee ~0.0001 VRSC)
- Medium data (5KB-1MB): `updateidentity` with `data` wrapper triggers automatic chunking
- Large data (>1MB): sequential `updateidentity` calls across multiple blocks
- **Critical**: `updateidentity` replaces the ENTIRE contentmultimap — must preserve existing entries
- Sequential updates only: each `updateidentity` spends the previous identity output (~60s per block minimum)

### Currencies & Tokens
- Anyone with a VerusID can create tokens via `definecurrency`
- Simple tokens (options: 32), fractional baskets (options: 33), PBaaS chains (options: 264)
- Centralized tokens (proofprotocol: 2) allow controller to mint/burn
- Each currency creates a namespace for SubIDs

### Agent Registry Schema
- Standard `ari::agent.v1.*` namespace with 9 fields
- Discovery: indexers scan for the type VDXF key across all identities
- A chess app could register using this schema for discoverability

### Marketplace (Atomic Swaps)
- `makeoffer`/`takeoffer` for peer-to-peer trading of currencies, tokens, and identities
- `getoffers`/`listopenoffers` for discovery
- No custody intermediaries needed

---

## Game Flow Diagrams

### Login Flow
```
QR Code → Wallet Scan → Sign Challenge → Verify Signature
→ Create User → JWT Cookie → Dashboard
```

### Game Creation Flow
```
User A selects User B → Challenge Emit → Socket Event → Challenge Popup
→ Accept → Create Game (POST /api/game) → Redirect both to /game/[gameId]
```

### Game Play Flow
```
1. Load game state from DB
2. Initialize Board class, calculateAllMoves()
3. Player clicks piece → select piece → show valid moves
4. Player clicks destination → playMove() → update local board
5. POST /api/game/[gameId]/move → save to DB
6. Socket: emit move-made → opponent receives update-board-state
7. Opponent's board updates (hydrate from JSON)
8. Check for checkmate → if yes, endGame() → status=COMPLETED
9. Show game-over screen with result
```

### Blockchain Storage Flow
```
1. Game ends (COMPLETED status)
2. User clicks "Store on Blockchain"
3. POST /api/game/[gameId]/store-blockchain
4. Server creates ChessGame VDXF object
5. Creates identity update transaction
6. Signs with VERUS_SIGNING_WIF
7. Broadcasts to network
8. Returns txId → stores in DB
```

---

## Environment Variables

```
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_APP_URL=             # Frontend domain
NEXT_PUBLIC_SOCKET_URL=          # Socket.IO server URL

VERUS_RPC_USER=                  # RPC authentication
VERUS_RPC_PASSWORD=
VERUS_RPC_HOST=
VERUS_RPC_PORT=
TESTNET=                         # Boolean flag

VERUS_SIGNING_ID=                # Identity name for storing games (e.g., "@username")
VERUS_SIGNING_WIF=               # Private key for signing transactions
VERUS_RPC_SYSTEM=                # System ID (testnet vs mainnet)
VERUS_LOGIN_IADDRESS=            # Login service I-address

JWT_SECRET=                      # Token signing key
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/app/layout.tsx` | Root layout with theme provider |
| `/app/page.tsx` | Landing/home page |
| `/app/login/page.tsx` | QR code login interface |
| `/app/dashboard/page.tsx` | Dashboard with stats/leaderboard |
| `/app/game/[gameId]/GameClient.tsx` | Main game logic component (595 lines) |
| `/app/game/[gameId]/actions.ts` | Server actions for game operations |
| `/app/models/Board.ts` | Chess board logic and piece coordination |
| `/app/models/Piece.ts` | Individual piece representation |
| `/app/models/Position.ts` | Board coordinate system |
| `/app/models/Pawn.ts` | Pawn-specific logic (en passant) |
| `/app/referee/rules.ts` | Move validation for all piece types |
| `/app/utils/verusLogin.js` | VerusID authentication logic |
| `/app/utils/blockchain-storage.js` | On-chain game storage implementation |
| `/app/utils/blockchain-move-storage-basic.js` | On-chain move storage |
| `/app/utils/deeplink.js` | QR code & deeplink generation |
| `/ChessGame.js` | VDXF serialization for blockchain |
| `/server.js` | Socket.IO real-time server |
| `/prisma/schema.prisma` | Database schema |
| `/lib/prisma.ts` | Prisma client singleton |
| `/components/chessboard/Chessboard.tsx` | Visual board component |
| `/components/dashboard/Leaderboard.tsx` | Win rankings display |

---

## Current Design Decisions & Limitations

1. **All games stored under one app-controlled identity** — not per-player
2. **Full board state stored as JSON** in DB (not replay from moves)
3. **Blockchain storage is post-game** — triggered after completion, not real-time
4. **Move validation is client-side only** — no server-side validation of legality
5. **SQLite file-based DB** — not production-ready
6. **No explicit API route protection** — relies on client-side JWT check
7. **Moves stored as 4-char strings** (e.g., "e2e4") — from + to squares
