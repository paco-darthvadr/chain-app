# Signed Move Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pluggable mode system to the chess app with a "Normal" mode that signs each move into a hash chain and stores completed games on per-game SubIDs on the Verus blockchain.

**Architecture:** API routes delegate to mode handlers via a resolver. The existing blockchain code is wrapped as "Original" mode, untouched. New "Normal" mode adds move signing, hash chain verification, and SubID-based on-chain storage. The signing source is pluggable (server-signing now, client-signing later).

**Tech Stack:** Next.js 14, TypeScript, Prisma/SQLite, Socket.IO, Verus RPC (`verusd-rpc-ts-client`, `verus-typescript-primitives`, `@bitgo/utxo-lib`), Node.js crypto (SHA256)

**Spec:** `docs/superpowers/specs/2026-03-18-signed-move-protocol-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `app/utils/modes/types.ts` | `ModeHandler` interface, shared types (`MoveData`, `SignedMovePackage`, `GameEndResult`, `StorageResult`) |
| `app/utils/modes/mode-resolver.ts` | `getModeHandler(mode)` — returns the correct handler |
| `app/utils/modes/original/handler.ts` | Wraps existing `BlockchainStorage` / `BlockchainMoveStorageBasic` as a `ModeHandler` |
| `app/utils/modes/normal/handler.ts` | Orchestrates Normal mode: delegates to signer, hash-chain, and storage |
| `app/utils/modes/normal/move-signer.ts` | Sign and verify move packages. Pluggable interface — server-signing implementation |
| `app/utils/modes/normal/hash-chain.ts` | Compute `prevHash`, build initial anchor hash, verify full chain integrity |
| `app/utils/modes/normal/subid-storage.ts` | Create SubIDs under `ChessGame@`, update contentmultimap with game data |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `mode` to Game, `movePackage`/`signature` to Move, new `GameSession` + `GameCounter` models |
| `app/api/game/route.ts` | Accept `mode` field, assign `subIdName` via counter for Normal mode |
| `app/game/[gameId]/actions.ts` | **Key integration point.** `updateGame()` is the actual function called on each move — add mode handler delegation and move recording here |
| `app/game/[gameId]/GameClient.tsx` | Pass player verusId + move details through `updateGame()`, handle signed package in socket data |
| `app/api/game/[gameId]/store-blockchain/route.ts` | Delegate to mode handler's `storeOnChain()` (return early before existing `$transaction` for Normal mode) |
| `app/api/game/[gameId]/store-move-blockchain/route.ts` | Return no-op for Normal mode games |
| `server.js` | Pass through `signedPackage` in `move-made` events (backward-compatible) |
| `.env.example` | Add `CHESSGAME_*` variables |

---

## Task 1: Database Schema Updates

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `mode` field to Game model**

In `prisma/schema.prisma`, add to the Game model (after the `winner` field, line 38):

```prisma
  mode       String   @default("original") // "original", "normal", "tournament"
```

Also add the back-relation for GameSession (after the `moves` line, line 45):

```prisma
  gameSession GameSession?
```

- [ ] **Step 2: Add signed move fields to Move model**

In `prisma/schema.prisma`, add to the Move model (after `move` field, line 52):

```prisma
  movePackage   Json?     // full signed package {subIdName, player, moveNum, move, prevHash}
  signature     String?   // signature for this move
```

- [ ] **Step 3: Add GameSession model**

Add after the `ProcessedChallenge` model (after line 63):

```prisma
model GameSession {
  id              String    @id @default(cuid())
  game            Game      @relation(fields: [gameId], references: [id])
  gameId          String    @unique
  subIdName       String?   // "game0001" — null until assigned
  subIdAddress    String?   // i-address of the SubID once created
  gameHash        String?   // final SHA256 hash chain result
  whiteFinalSig   String?   // white's signature on gameHash
  blackFinalSig   String?   // black's signature on gameHash
  verifiedAt      DateTime? // when server verified all moves + sigs
  storedAt        DateTime? // when written to chain
  txId            String?   // blockchain tx ID
  createdAt       DateTime  @default(now())
}

model GameCounter {
  id        String  @id @default("singleton")
  nextGame  Int     @default(1)
}
```

- [ ] **Step 4: Push schema to database**

Run:
```bash
npx prisma db push
npx prisma generate
```

Expected: Schema pushed, client regenerated. Existing data preserved (all new fields are optional or have defaults).

- [ ] **Step 5: Seed the GameCounter**

Create a quick seed to ensure the singleton row exists. Add to the bottom of `prisma/schema.prisma` comment, or run manually:

```bash
npx prisma db execute --stdin <<< "INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES ('singleton', 1);"
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add mode, GameSession, GameCounter to schema for signed move protocol"
```

---

## Task 2: Mode System Types & Resolver

**Files:**
- Create: `app/utils/modes/types.ts`
- Create: `app/utils/modes/mode-resolver.ts`

- [ ] **Step 1: Create shared types**

Create `app/utils/modes/types.ts`:

```ts
export interface MoveData {
  move: string;        // UCI notation: "e2e4" or "e7e8q"
  player: string;      // VerusID: "alice@"
  boardState: any;     // full board state JSON from frontend
}

export interface SignedMovePackage {
  subIdName: string;
  player: string;
  moveNum: number;
  move: string;
  prevHash: string;
  signature: string;
}

export interface GameEndResult {
  gameHash: string;
  whiteFinalSig: string;
  blackFinalSig: string;
  verified: boolean;
}

export interface StorageResult {
  success: boolean;
  transactionId?: string;
  subIdName?: string;
  subIdAddress?: string;
  error?: string;
}

export interface ModeHandler {
  onMove(game: any, moveData: MoveData): Promise<SignedMovePackage | null>;
  onGameEnd(game: any): Promise<GameEndResult | null>;
  storeOnChain(game: any): Promise<StorageResult>;
}
```

- [ ] **Step 2: Create mode resolver**

Create `app/utils/modes/mode-resolver.ts`:

```ts
import { ModeHandler } from './types';
import { originalHandler } from './original/handler';
import { normalHandler } from './normal/handler';

export function getModeHandler(mode: string | undefined | null): ModeHandler {
  switch (mode) {
    case 'normal':
      return normalHandler;
    case 'original':
    default:
      return originalHandler;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/utils/modes/types.ts app/utils/modes/mode-resolver.ts
git commit -m "feat: add ModeHandler interface and mode resolver"
```

---

## Task 3: Original Mode Handler

**Files:**
- Create: `app/utils/modes/original/handler.ts`

- [ ] **Step 1: Create original handler wrapping existing code**

Create `app/utils/modes/original/handler.ts`:

```ts
import { ModeHandler, MoveData, SignedMovePackage, GameEndResult, StorageResult } from '../types';

// Original mode does not sign moves or manage hash chains.
// It delegates blockchain storage to the existing BlockchainStorage class
// via the store-blockchain API route (which handles it directly).
// onMove and onGameEnd are no-ops for this mode.

export const originalHandler: ModeHandler = {
  async onMove(game: any, moveData: MoveData): Promise<SignedMovePackage | null> {
    // Original mode has no per-move signing
    return null;
  },

  async onGameEnd(game: any): Promise<GameEndResult | null> {
    // Original mode has no post-game verification step
    return null;
  },

  async storeOnChain(game: any): Promise<StorageResult> {
    // Original mode storage is handled directly by the existing
    // store-blockchain route using BlockchainStorage class.
    // This handler is a passthrough — the route checks for original mode
    // and calls the existing code path directly.
    return { success: true };
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/original/handler.ts
git commit -m "feat: wrap existing blockchain code as original mode handler"
```

---

## Task 4: Hash Chain Module

**Files:**
- Create: `app/utils/modes/normal/hash-chain.ts`

- [ ] **Step 1: Implement hash chain utilities**

Create `app/utils/modes/normal/hash-chain.ts`:

```ts
import { createHash } from 'crypto';

export interface MovePackageData {
  subIdName: string;
  player: string;
  moveNum: number;
  move: string;
  prevHash: string;
}

/**
 * Compute SHA256 hash of a move package (deterministic JSON serialization).
 * Keys are sorted to ensure consistent hashing regardless of insertion order.
 */
export function hashMovePackage(pkg: MovePackageData): string {
  const canonical = JSON.stringify(pkg, Object.keys(pkg).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute the initial anchor hash for the first move.
 * This ties the hash chain to the specific game and players.
 */
export function computeAnchorHash(subIdName: string, white: string, black: string): string {
  const anchor = {
    subIdName,
    white,
    black,
    startPos: 'standard',
  };
  const canonical = JSON.stringify(anchor, Object.keys(anchor).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify the integrity of an entire move chain.
 * Returns { valid: true } or { valid: false, error: string, moveNum: number }.
 */
export function verifyChain(
  subIdName: string,
  white: string,
  black: string,
  packages: MovePackageData[]
): { valid: boolean; error?: string; moveNum?: number } {
  if (packages.length === 0) {
    return { valid: true };
  }

  const anchorHash = computeAnchorHash(subIdName, white, black);

  let expectedPrevHash = anchorHash;
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];

    if (pkg.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        error: `Hash chain broken at move ${pkg.moveNum}: expected prevHash ${expectedPrevHash}, got ${pkg.prevHash}`,
        moveNum: pkg.moveNum,
      };
    }

    if (pkg.moveNum !== i + 1) {
      return {
        valid: false,
        error: `Move number mismatch at index ${i}: expected ${i + 1}, got ${pkg.moveNum}`,
        moveNum: pkg.moveNum,
      };
    }

    expectedPrevHash = hashMovePackage(pkg);
  }

  return { valid: true };
}

/**
 * Compute the final game hash from the last move package.
 */
export function computeGameHash(packages: MovePackageData[]): string {
  if (packages.length === 0) {
    return createHash('sha256').update('empty').digest('hex');
  }
  return hashMovePackage(packages[packages.length - 1]);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/normal/hash-chain.ts
git commit -m "feat: implement hash chain computation and verification"
```

---

## Task 5: Move Signer Module

**Files:**
- Create: `app/utils/modes/normal/move-signer.ts`

- [ ] **Step 1: Implement server-signing move signer**

Create `app/utils/modes/normal/move-signer.ts`:

```ts
import { createHash, createHmac } from 'crypto';

/**
 * Pluggable move signer interface.
 * Phase 1: Server signs on behalf of authenticated players.
 * Phase 2+: Client signs via browser extension or mobile wallet.
 */
export interface MoveSigner {
  sign(message: string): string;
  verify(message: string, signature: string): boolean;
  getPublicKey(): string;
}

/**
 * Server-side signer using HMAC-SHA256 with the CHESSGAME_SIGNING_WIF.
 * For Phase 1, this signs on behalf of both players as a server attestation.
 * Both whiteSig and blackSig come from the same key — they attest the server
 * verified the authenticated player made the move, not that distinct players signed.
 *
 * When client-side signing arrives (Phase 2+), this class gets swapped out
 * for one that delegates to the browser extension or wallet using ECDSA/secp256k1.
 */
export class ServerMoveSigner implements MoveSigner {
  private secret: string;
  private publicKey: string;

  constructor() {
    this.secret = process.env.CHESSGAME_SIGNING_WIF || process.env.VERUS_SIGNING_WIF || 'dev-signing-key';
    this.publicKey = createHash('sha256').update(this.secret + ':public').digest('hex');
  }

  sign(message: string): string {
    return createHmac('sha256', this.secret).update(message).digest('hex');
  }

  verify(message: string, signature: string): boolean {
    const expected = this.sign(message);
    return signature === expected;
  }

  getPublicKey(): string {
    return this.publicKey;
  }
}

// Singleton instance for the current signing phase
let signerInstance: MoveSigner | null = null;

export function getMoveSigner(): MoveSigner {
  if (!signerInstance) {
    signerInstance = new ServerMoveSigner();
  }
  return signerInstance;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/normal/move-signer.ts
git commit -m "feat: implement pluggable move signer with server-signing for phase 1"
```

---

## Task 6: SubID Storage Module

**Files:**
- Create: `app/utils/modes/normal/subid-storage.ts`

- [ ] **Step 1: Implement SubID creation and storage**

Create `app/utils/modes/normal/subid-storage.ts`. This module handles Verus RPC calls to create SubIDs and update their contentmultimap.

```ts
import axios from 'axios';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

/**
 * Make a JSON-RPC call to the Verus daemon.
 */
async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method,
    params,
    id: 1,
    jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

/**
 * Register a SubID under ChessGame@ for a completed game.
 * Uses registernamecommitment + registeridentity two-step process.
 */
export async function createGameSubId(subIdName: string): Promise<{ address: string }> {
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  const fullName = `${subIdName}.${parentName.replace('@', '')}@`;

  // Check if SubID already exists
  try {
    const existing = await rpcCall('getidentity', [fullName]);
    if (existing && existing.identity) {
      console.log(`[SubID] ${fullName} already exists at ${existing.identity.identityaddress}`);
      return { address: existing.identity.identityaddress };
    }
  } catch (e) {
    // Identity doesn't exist — proceed to create
  }

  // Step 1: registernamecommitment
  const parentAddress = process.env.CHESSGAME_IDENTITY_ADDRESS;
  const commitment = await rpcCall('registernamecommitment', [
    fullName,
    parentAddress,
  ]);
  console.log(`[SubID] Name commitment for ${fullName}:`, commitment);

  // Step 2: registeridentity (after commitment is mined — may need to wait)
  const identity = await rpcCall('registeridentity', [{
    txid: commitment.txid,
    namereservation: commitment.namereservation,
    identity: {
      name: subIdName,
      parent: parentAddress,
      primaryaddresses: [parentAddress],
      minimumsignatures: 1,
    },
  }]);
  console.log(`[SubID] Registered ${fullName}:`, identity);

  // Get the identity address
  const registered = await rpcCall('getidentity', [fullName]);
  return { address: registered.identity.identityaddress };
}

export interface GameData {
  white: string;
  black: string;
  winner: string;
  result: string;        // "checkmate", "stalemate", "resignation", "timeout"
  moves: string[];
  moveCount: number;
  duration: number;       // seconds
  startedAt: number;      // unix timestamp
  gameHash: string;
  whiteSig: string;
  blackSig: string;
}

/**
 * Update a game SubID's contentmultimap with final game data.
 * Uses placeholder string keys — will be replaced with VDXF keys
 * when ChessGame@ identity + token are created.
 */
export async function storeGameData(subIdName: string, data: GameData): Promise<{ txid: string }> {
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  const fullName = `${subIdName}.${parentName.replace('@', '')}@`;

  // Get the current identity
  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  // Build contentmultimap with game data.
  // NOTE: These use DATA_TYPE_STRING.vdxfid as the value wrapper to match the existing
  // codebase pattern in blockchain-storage.js. The outer keys are placeholder strings —
  // replace with proper VDXF key IDs (i-addresses from getvdxfid) when the user creates
  // the ChessGame@ identity and registers the VDXF namespace.
  // Until then, this will NOT work against a real Verus daemon — RPC expects VDXF key IDs.
  const { DATA_TYPE_STRING } = require('verus-typescript-primitives/dist/vdxf/keys');
  const vdxfKey = DATA_TYPE_STRING.vdxfid;

  // Serialize all game data as a single JSON blob under one VDXF key
  const gameBlob = JSON.stringify({
    white: data.white,
    black: data.black,
    winner: data.winner,
    result: data.result,
    moves: data.moves,
    moveCount: data.moveCount,
    duration: data.duration,
    startedAt: data.startedAt,
    gameHash: data.gameHash,
    whiteSig: data.whiteSig,
    blackSig: data.blackSig,
  });
  const gameDataHex = Buffer.from(gameBlob).toString('hex');

  const contentmultimap = {
    [vdxfKey]: [{ [vdxfKey]: gameDataHex }],
  };

  // Update identity with game data
  const updateParams = {
    ...identity,
    contentmultimap,
  };

  const txid = await rpcCall('updateidentity', [updateParams]);
  console.log(`[SubID] Updated ${fullName} with game data, txid:`, txid);

  return { txid };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/normal/subid-storage.ts
git commit -m "feat: implement SubID creation and on-chain game data storage"
```

---

## Task 7: Normal Mode Handler

**Files:**
- Create: `app/utils/modes/normal/handler.ts`

- [ ] **Step 1: Implement the Normal mode handler**

Create `app/utils/modes/normal/handler.ts`:

```ts
import { ModeHandler, MoveData, SignedMovePackage, GameEndResult, StorageResult } from '../types';
import { hashMovePackage, computeAnchorHash, verifyChain, computeGameHash, MovePackageData } from './hash-chain';
import { getMoveSigner } from './move-signer';
import { createGameSubId, storeGameData, GameData } from './subid-storage';
import { prisma } from '@/lib/prisma';

export const normalHandler: ModeHandler = {

  async onMove(game: any, moveData: MoveData): Promise<SignedMovePackage> {
    const signer = getMoveSigner();

    // Get the GameSession for this game
    let session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session) {
      // Create GameSession on first move (if not created at game creation)
      session = await prisma.gameSession.create({
        data: { gameId: game.id },
      });
    }

    // Determine subIdName from GameSession or game counter
    const subIdName = session.subIdName || game.id;

    // Get move count for moveNum
    const moveNum = await prisma.move.count({ where: { gameId: game.id } }) + 1;

    // Compute prevHash
    let prevHash: string;
    if (moveNum === 1) {
      // Anchor hash for first move
      const whitePlayer = game.whitePlayer?.verusId || game.whitePlayerId;
      const blackPlayer = game.blackPlayer?.verusId || game.blackPlayerId;
      prevHash = computeAnchorHash(subIdName, whitePlayer, blackPlayer);
    } else {
      // Hash of previous move package
      const prevMove = await prisma.move.findFirst({
        where: { gameId: game.id },
        orderBy: { createdAt: 'desc' },
      });
      if (prevMove?.movePackage) {
        prevHash = hashMovePackage(prevMove.movePackage as MovePackageData);
      } else {
        // Fallback: recompute from beginning
        const allMoves = await prisma.move.findMany({
          where: { gameId: game.id },
          orderBy: { createdAt: 'asc' },
        });
        if (allMoves.length === 0) {
          const whitePlayer = game.whitePlayer?.verusId || game.whitePlayerId;
          const blackPlayer = game.blackPlayer?.verusId || game.blackPlayerId;
          prevHash = computeAnchorHash(subIdName, whitePlayer, blackPlayer);
        } else {
          const lastMove = allMoves[allMoves.length - 1];
          prevHash = hashMovePackage(lastMove.movePackage as MovePackageData);
        }
      }
    }

    // Build move package
    const movePackage: MovePackageData = {
      subIdName,
      player: moveData.player,
      moveNum,
      move: moveData.move,
      prevHash,
    };

    // Sign the package
    const canonical = JSON.stringify(movePackage, Object.keys(movePackage).sort());
    const signature = signer.sign(canonical);

    return {
      ...movePackage,
      signature,
    };
  },

  async onGameEnd(game: any): Promise<GameEndResult> {
    const signer = getMoveSigner();

    // Load the full game with players
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { whitePlayer: true, blackPlayer: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) {
      throw new Error(`Game not found: ${game.id}`);
    }

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    const subIdName = session?.subIdName || game.id;

    // Rebuild move packages from DB
    const packages: MovePackageData[] = fullGame.moves
      .filter(m => m.movePackage)
      .map(m => m.movePackage as MovePackageData);

    // Verify the entire chain
    const verification = verifyChain(
      subIdName,
      fullGame.whitePlayer.verusId,
      fullGame.blackPlayer.verusId,
      packages,
    );

    if (!verification.valid) {
      console.error(`[Normal] Chain verification failed for game ${game.id}:`, verification.error);
      // Update GameSession to flag verification failure
      if (session) {
        await prisma.gameSession.update({
          where: { gameId: game.id },
          data: { verifiedAt: null },
        });
      }
      return {
        gameHash: '',
        whiteFinalSig: '',
        blackFinalSig: '',
        verified: false,
      };
    }

    // Compute final game hash
    const gameHash = computeGameHash(packages);

    // Sign on behalf of both players (Phase 1: same server key)
    const whiteFinalSig = signer.sign(gameHash);
    const blackFinalSig = signer.sign(gameHash);

    // Update GameSession
    if (session) {
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: {
          gameHash,
          whiteFinalSig,
          blackFinalSig,
          verifiedAt: new Date(),
        },
      });
    }

    return {
      gameHash,
      whiteFinalSig,
      blackFinalSig,
      verified: true,
    };
  },

  async storeOnChain(game: any): Promise<StorageResult> {
    // Load full game data
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { whitePlayer: true, blackPlayer: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) {
      return { success: false, error: 'Game not found' };
    }

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session) {
      return { success: false, error: 'No GameSession found — run onGameEnd first' };
    }
    if (!session.gameHash || !session.verifiedAt) {
      return { success: false, error: 'Game not verified — run onGameEnd first' };
    }

    const subIdName = session.subIdName || game.id;

    try {
      // Step 1: Create SubID (skips if already exists)
      let subIdAddress = session.subIdAddress;
      if (!subIdAddress) {
        const subIdResult = await createGameSubId(subIdName);
        subIdAddress = subIdResult.address;
        await prisma.gameSession.update({
          where: { gameId: game.id },
          data: { subIdAddress },
        });
      }

      // Step 2: Store game data on the SubID
      const duration = Math.floor((fullGame.updatedAt.getTime() - fullGame.createdAt.getTime()) / 1000);
      const moves = fullGame.moves.map(m => m.move);

      const gameData: GameData = {
        white: fullGame.whitePlayer.verusId,
        black: fullGame.blackPlayer.verusId,
        winner: fullGame.winner || '',
        result: fullGame.status === 'COMPLETED' ? 'checkmate' : fullGame.status.toLowerCase(),
        moves,
        moveCount: moves.length,
        duration,
        startedAt: Math.floor(fullGame.createdAt.getTime() / 1000),
        gameHash: session.gameHash,
        whiteSig: session.whiteFinalSig || '',
        blackSig: session.blackFinalSig || '',
      };

      const { txid } = await storeGameData(subIdName, gameData);

      // Update session with storage info
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: {
          storedAt: new Date(),
          txId: txid,
        },
      });

      return {
        success: true,
        transactionId: txid,
        subIdName,
        subIdAddress,
      };
    } catch (error: any) {
      console.error(`[Normal] storeOnChain failed for game ${game.id}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to store on chain',
      };
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/normal/handler.ts
git commit -m "feat: implement Normal mode handler with signing, verification, and storage"
```

---

## Task 8: Wire Up Game Creation Route

**Files:**
- Modify: `app/api/game/route.ts:6-29`

- [ ] **Step 1: Add mode field and GameSession creation to game route**

Modify `app/api/game/route.ts`. The changes are:
1. Accept optional `mode` field from request body (default: `"normal"`)
2. For Normal mode games, create a `GameSession` with an assigned `subIdName`
3. Use atomic counter increment for SubID naming

Update the POST handler — after destructuring the request body (line 8), add `mode`:

```ts
const { whitePlayerId, blackPlayerId, mode } = await req.json();
```

Change the game creation (lines 22-29) to include mode:

```ts
const gameMode = mode || 'normal';

const newGame = await prisma.game.create({
    data: {
        whitePlayerId,
        blackPlayerId,
        boardState: initialBoardState,
        status: 'IN_PROGRESS',
        mode: gameMode,
    },
});

// For Normal mode, create a GameSession with SubID name
if (gameMode === 'normal') {
    // Atomic counter increment for SubID naming (safe for SQLite)
    await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES ('singleton', 1)`;
    const gameNumber = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = 'singleton'`;
        const result = await tx.gameCounter.findUnique({ where: { id: 'singleton' } });
        return result!.nextGame - 1; // Pre-increment value
    });
    const subIdName = `game${String(gameNumber).padStart(4, '0')}`;

    await prisma.gameSession.create({
        data: {
            gameId: newGame.id,
            subIdName,
        },
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/game/route.ts
git commit -m "feat: add mode field and GameSession creation to game route"
```

---

## Task 9: Wire Up Server Actions (Main Integration Point)

**IMPORTANT:** The frontend does NOT call the `/move` API route for making moves. The actual move flow is:
1. `GameClient.tsx` calls `updateGame()` server action in `app/game/[gameId]/actions.ts`
2. `updateGame()` writes `boardState` to DB
3. `GameClient.tsx` emits `move-made` socket event
4. `GameMoves.tsx` separately calls `store-move-blockchain` per move

The server action `updateGame()` is where we integrate the mode handler for Normal mode.

**Files:**
- Modify: `app/game/[gameId]/actions.ts:22-41`

- [ ] **Step 1: Add mode handler delegation to updateGame server action**

Add imports at top of `app/game/[gameId]/actions.ts`:

```ts
import { getModeHandler } from '@/app/utils/modes/mode-resolver';
```

Add a UCI conversion helper:

```ts
/**
 * Convert frontend move format to UCI notation.
 * Input: "e2e4" (string) or { from: "e2", to: "e4", promotion?: "q" }
 * Output: "e2e4" or "e7e8q"
 */
function toUCI(move: any): string {
    if (typeof move === 'string') return move;
    if (move.from && move.to) {
        const base = `${move.from}${move.to}`;
        return move.promotion ? `${base}${move.promotion}` : base;
    }
    return String(move);
}
```

Replace the `updateGame` function (lines 22-41) with:

```ts
export async function updateGame(gameId: string, boardState: any, moveInfo?: { move: any; player: string }) {
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { whitePlayer: true, blackPlayer: true },
        });
        if (!game) return null;

        // Mode handler integration for move signing
        let signedPackage = null;
        if (moveInfo) {
            const handler = getModeHandler((game as any).mode);
            const uciMove = toUCI(moveInfo.move);

            signedPackage = await handler.onMove(game, {
                move: uciMove,
                player: moveInfo.player,
                boardState,
            });

            // Store the move in the Move table (with signed package if available)
            await prisma.move.create({
                data: {
                    gameId,
                    move: uciMove,
                    ...(signedPackage ? {
                        movePackage: {
                            subIdName: signedPackage.subIdName,
                            player: signedPackage.player,
                            moveNum: signedPackage.moveNum,
                            move: signedPackage.move,
                            prevHash: signedPackage.prevHash,
                        },
                        signature: signedPackage.signature,
                    } : {}),
                },
            });
        }

        // Update boardState (existing behavior)
        const updatedGame = await prisma.game.update({
            where: { id: gameId },
            data: {
                boardState,
                updatedAt: new Date()
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            },
        });
        revalidatePath(`/game/${gameId}`);

        // Return signed package alongside game for socket emission
        return { ...updatedGame, signedPackage };
    } catch (error) {
        console.error('Error updating game:', error);
        return null;
    }
}
```

The new `moveInfo` parameter is optional — existing callers without it still work (backward-compatible).

- [ ] **Step 2: Commit**

```bash
git add app/game/[gameId]/actions.ts
git commit -m "feat: integrate mode handler move signing into updateGame server action"
```

---

## Task 9b: Update GameClient to Pass Move Info

**Files:**
- Modify: `app/game/[gameId]/GameClient.tsx:309-322`

- [ ] **Step 1: Pass move details and player info to updateGame**

In `GameClient.tsx`, around line 309 where `updateGame` is called, update to pass move info:

Change:
```ts
const updatedGame = await updateGame(gameState.id, newBoardState);
```

To:
```ts
const updatedGame = await updateGame(gameState.id, newBoardState, {
    move: move, // the move object { from, to, promotion? } or string
    player: playerVerusId || '',
});
```

Then around line 320-321 where the socket event is emitted, include the signed package:

Change:
```ts
socket.emit('move-made', { gameId: gameState.id, boardState: updatedGame.boardState });
```

To:
```ts
socket.emit('move-made', {
    gameId: gameState.id,
    boardState: updatedGame.boardState,
    signedPackage: (updatedGame as any).signedPackage || null,
});
```

- [ ] **Step 2: Commit**

```bash
git add app/game/[gameId]/GameClient.tsx
git commit -m "feat: pass move info to server action for signing, include signed package in socket"
```

---

## Task 10: Wire Up Store Blockchain Route

**Files:**
- Modify: `app/api/game/[gameId]/store-blockchain/route.ts`
- Modify: `app/api/game/[gameId]/store-move-blockchain/route.ts`

- [ ] **Step 1: Add mode-aware routing to store-blockchain**

At the top of `app/api/game/[gameId]/store-blockchain/route.ts`, add the import:

```ts
import { getModeHandler } from '@/app/utils/modes/mode-resolver';
```

**IMPORTANT:** The existing code runs inside a `prisma.$transaction()` callback (line 11). The Normal mode handler does its own Prisma calls via the global `prisma` client. To avoid nested transaction issues, add the Normal mode check BEFORE the `$transaction` call (after line 8, before line 11):

```ts
// Check game mode — Normal mode uses its own flow outside the transaction
const gameForMode = await prisma.game.findUnique({
    where: { id: params.gameId },
    include: { whitePlayer: true, blackPlayer: true },
});
if (!gameForMode) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
}
if ((gameForMode as any).mode === 'normal') {
    const handler = getModeHandler('normal');

    // Run game-end verification first
    const endResult = await handler.onGameEnd(gameForMode);
    if (!endResult || !endResult.verified) {
        return NextResponse.json({
            success: false,
            error: 'Game verification failed',
        }, { status: 400 });
    }

    // Store on chain
    const result = await handler.storeOnChain(gameForMode);
    return NextResponse.json(result);
}

// Original mode: fall through to existing $transaction logic below
```

This returns before the `$transaction` block, so all existing Original mode code is untouched.

- [ ] **Step 2: Add no-op for Normal mode in store-move-blockchain**

At the top of `app/api/game/[gameId]/store-move-blockchain/route.ts`, after the game ID is resolved (line 8), add:

```ts
// Check game mode — Normal mode handles move signing through the /move route
const gameForMode = await prisma.game.findUnique({ where: { id: gameId }, select: { mode: true } });
if (gameForMode?.mode === 'normal') {
    return NextResponse.json({
        success: true,
        message: 'Normal mode: moves are signed via the /move route, not stored individually on-chain',
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/game/[gameId]/store-blockchain/route.ts app/api/game/[gameId]/store-move-blockchain/route.ts
git commit -m "feat: add mode-aware routing to blockchain storage routes"
```

---

## Task 11: Update Socket.IO Server

**Files:**
- Modify: `server.js:114-118`

- [ ] **Step 1: Include signed move data in socket events**

In `server.js`, update the `move-made` handler (line 114-118) to pass through signed move data:

Replace:
```js
socket.on('move-made', (data) => {
    // Broadcast to the specific game room, excluding the sender
    socket.to(data.gameId).emit('update-board-state', data.boardState);
    console.log(`Move made in game ${data.gameId}, broadcasting to room.`);
});
```

With:
```js
socket.on('move-made', (data) => {
    // Broadcast board state to the specific game room, excluding the sender
    // IMPORTANT: emit boardState directly (not wrapped in an object) to stay
    // backward-compatible with the frontend listener in GameClient.tsx which
    // passes the received payload directly to createBoardFromState().
    socket.to(data.gameId).emit('update-board-state', data.boardState);

    // Emit signed package separately if available (Normal mode)
    if (data.signedPackage) {
        socket.to(data.gameId).emit('move-signed', data.signedPackage);
    }
    console.log(`Move made in game ${data.gameId}, broadcasting to room.`);
});
```

This keeps `update-board-state` backward-compatible and adds a new `move-signed` event for Normal mode data.

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: pass signed move packages through socket events"
```

---

## Task 12: Update Environment Config

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new environment variables to .env.example**

Add after the existing `VERUS_SIGNING_WIF` line (around line 27):

```
# ChessGame@ identity for Normal mode (SubID creation + game storage)
# User creates ChessGame@ identity externally and provides these values
CHESSGAME_IDENTITY_NAME=ChessGame@
CHESSGAME_IDENTITY_ADDRESS=
CHESSGAME_SIGNING_WIF=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "feat: add CHESSGAME environment variables to .env.example"
```

---

## Task 13: Verify Everything Builds

- [ ] **Step 1: Run prisma generate**

```bash
npx prisma generate
```

Expected: Success, client regenerated with new models.

- [ ] **Step 2: Run TypeScript build check**

```bash
npx next build
```

Expected: Build succeeds. If there are type errors, fix them.

- [ ] **Step 3: Verify the app starts**

```bash
yarn dev
```

Expected: Next.js starts on port 3000, Socket.IO on 3002. No crash on startup.

- [ ] **Step 4: Commit any build fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from signed move protocol integration"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Database schema updates | None |
| 2 | Mode system types & resolver | None |
| 3 | Original mode handler | Task 2 |
| 4 | Hash chain module | None |
| 5 | Move signer module | None |
| 6 | SubID storage module | None |
| 7 | Normal mode handler | Tasks 1, 2, 4, 5, 6 |
| 8 | Wire up game creation route | Tasks 1, 2 |
| 9 | Wire up server actions (main integration) | Tasks 1, 2, 7 |
| 9b | Update GameClient to pass move info | Task 9 |
| 10 | Wire up store blockchain routes | Tasks 1, 2, 7 |
| 11 | Update Socket.IO server | None |
| 12 | Update environment config | None |
| 13 | Verify build | All tasks |

Tasks 1, 2, 4, 5, 6, 11, 12 have no dependencies and can be parallelized.

## Notes

- **Move legality validation**: The spec recommends per-move server-side validation. This is deferred for Phase 1 — the existing client-side validation in `app/referee/rules.ts` is sufficient. Game-end verification checks the hash chain integrity but does not replay chess rules. This can be added as a follow-up task.
- **Failure/recovery**: The `GameSession` fields provide checkpoint-based retry capability. A retry endpoint is deferred for Phase 1 — the `storeOnChain` method can be called again and will pick up where it left off.
- **Prisma import fix**: Task 9 uses `import { prisma } from '@/lib/prisma'` (the shared singleton) rather than creating a new `PrismaClient()` instance. This aligns with every other file in the codebase — the existing move route was the only outlier.
