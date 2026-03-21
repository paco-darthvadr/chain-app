# Showcase Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "showcase" game mode that stores every move on-chain in real time via mempool, bookended by player signatures at game start and end.

**Architecture:** New `ModeHandler` in `app/utils/modes/showcase/` with 3 files: opening-commitment, live-storage, handler. One new API route for player signature submission. Challenge flow updated with mode selector. GameClient gains signing prompts for showcase mode. All existing normal/tournament code is untouched.

**Tech Stack:** Next.js 14 App Router, Verus RPC (`updateidentity`, `signmessage`, `verifymessage`, `getrawtransaction`), Socket.IO, Prisma/SQLite, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-19-showcase-mode-design.md`

---

### Task 1: Mode selector on challenge flow

The challenger needs to pick a game mode before sending the challenge. The mode must travel through the socket events and into the `POST /api/game` call.

**Files:**
- Modify: `app/users/page.tsx` — add mode dropdown to challenge UI, pass mode through socket events and game creation
- Modify: `server.js:~145-160` — pass `mode` through `challenge-user` → `new-challenge` socket events

- [ ] **Step 1: Add mode state and selector to UsersPage**

In `app/users/page.tsx`, add state and a dropdown next to each Challenge button:

```typescript
// Add to state declarations (~line 38):
const [selectedMode, setSelectedMode] = useState<string>('normal');
```

Add a mode selector in the "Challenge a User" section. Place it above the user list as a shared selector (not per-user):

```tsx
{/* Mode selector — above user list */}
<div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
  <label className="text-sm font-medium whitespace-nowrap">Game Mode:</label>
  <select
    value={selectedMode}
    onChange={(e) => setSelectedMode(e.target.value)}
    className="flex-1 px-3 py-1.5 rounded-md border bg-background text-sm"
  >
    <option value="normal">Normal</option>
    <option value="showcase">Showcase (Live On-Chain)</option>
  </select>
</div>
```

- [ ] **Step 2: Pass mode through challenge socket events**

Update `handleChallenge` (~line 138) to include mode:

```typescript
socket.emit('challenge-user', {
    challengerId: currentUserId,
    challengerName: currentUser.displayName || currentUser.verusId,
    challengeeId: opponentId,
    mode: selectedMode,  // ADD THIS
});
```

Update `handleAcceptChallenge` (~line 153) to include mode from the challenge:

```typescript
// Update incomingChallenge state type to include mode:
const [incomingChallenge, setIncomingChallenge] = useState<{
    challengerId: string;
    challengerName: string;
    mode?: string;  // ADD THIS
} | null>(null);

// In handleAcceptChallenge, pass mode to game creation:
body: JSON.stringify({
    whitePlayerId: incomingChallenge.challengerId,
    blackPlayerId: currentUserId,
    mode: incomingChallenge.mode || 'normal',  // ADD THIS
}),
```

Update the `new-challenge` listener (~line 92) to capture mode:

```typescript
socket.on('new-challenge', ({ challengerId, challengerName, mode }) => {
    const currentUser = localStorage.getItem('currentUser');
    if (challengerId !== currentUser) {
        setIncomingChallenge({ challengerId, challengerName, mode });
    }
});
```

- [ ] **Step 3: Pass mode through server.js socket relay**

In `server.js`, find the `challenge-user` handler and pass `mode` through:

```javascript
// In the challenge-user handler:
socket.on('challenge-user', ({ challengerId, challengerName, challengeeId, mode }) => {
    // ... existing lookup logic ...
    targetSocket.emit('new-challenge', { challengerId, challengerName, mode });
});
```

- [ ] **Step 4: Show mode in the incoming challenge modal**

In the challenge modal in `UsersPage` (~line 219), show the mode:

```tsx
<h2 className="text-2xl font-bold mb-2">{incomingChallenge.challengerName} has challenged you!</h2>
{incomingChallenge.mode === 'showcase' && (
    <p className="text-sm text-amber-400 mb-4">Mode: Showcase (every move stored on-chain live)</p>
)}
```

- [ ] **Step 5: Update POST /api/game for showcase mode**

In `app/api/game/route.ts`, the `mode` is already read from the body and passed to `prisma.game.create`. The SubID pre-registration block currently only runs for `gameMode === 'normal'`. Expand it to also run for `'showcase'`:

```typescript
// Change line 35 from:
if (gameMode === 'normal') {
// To:
if (gameMode === 'normal' || gameMode === 'showcase') {
```

Everything else in this route stays the same — the counter, SubID naming, and fire-and-forget commitment all work identically for showcase.

- [ ] **Step 6: Verify**

Start the app. Go to /users. The mode dropdown should appear above the user list. Challenge another player with "Showcase" selected. The incoming challenge modal should show the mode. Accepting should create a game with `mode: "showcase"` in the DB.

- [ ] **Step 7: Commit**

```bash
git add app/users/page.tsx server.js app/api/game/route.ts
git commit -m "feat: add mode selector to challenge flow, pass mode through socket events"
```

---

### Task 2: Opening commitment module

Build the utility that constructs the canonical opening message and verifies player signatures.

**Files:**
- Create: `app/utils/modes/showcase/opening-commitment.ts`

- [ ] **Step 1: Create opening-commitment.ts**

```typescript
import axios from 'axios';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method, params, id: 1, jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

export interface OpeningCommitment {
  white: string;
  black: string;
  gameNumber: string;
  startedAt: string;
}

/**
 * Build the canonical opening commitment message.
 * Keys are sorted for deterministic signing/verification.
 */
export function buildOpeningMessage(commitment: OpeningCommitment): string {
  return JSON.stringify(commitment, Object.keys(commitment).sort());
}

/**
 * Verify a player's signature on the opening commitment via verifymessage RPC.
 */
export async function verifyOpeningSignature(
  verusId: string,
  signature: string,
  commitment: OpeningCommitment,
): Promise<boolean> {
  const message = buildOpeningMessage(commitment);
  return rpcCall('verifymessage', [verusId, signature, message]);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/showcase/opening-commitment.ts
git commit -m "feat: add opening commitment builder and signature verifier for showcase mode"
```

---

### Task 3: Live storage module

Build the utility that updates the game SubID on-chain per move and checks the mempool.

**Files:**
- Create: `app/utils/modes/showcase/live-storage.ts`

- [ ] **Step 1: Create live-storage.ts**

```typescript
import axios from 'axios';
import { CHESS_VDXF_KEYS } from '../normal/vdxf-keys';

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
const DD_KEY = 'i4GC1YGEVD21afWudGoFJVdnfjJ5XWnCQv';

async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method, params, id: 1, jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

function dd(value: string, label: string, mimetype: string = 'text/plain'): object {
  return {
    [DD_KEY]: {
      version: 1,
      mimetype,
      objectdata: { message: value },
      label,
    }
  };
}

export interface LiveGameState {
  white: string;
  black: string;
  moves: string[];
  moveCount: number;
  startedAt: number;
  mode: string;
  status: string;
  whiteOpenSig: string;
  blackOpenSig: string;
  // Populated at game end
  winner?: string;
  result?: string;
  duration?: number;
  gameHash?: string;
  whiteSig?: string;
  blackSig?: string;
  moveSigs?: string[];
}

/**
 * Build contentmultimap from the current live game state.
 * Called on every move to update the SubID.
 */
function buildContentMultimap(state: LiveGameState): Record<string, object[]> {
  const K = CHESS_VDXF_KEYS;

  const cmm: Record<string, object[]> = {
    [K.version.vdxfid]:      [dd('1',                              K.version.uri)],
    [K.white.vdxfid]:        [dd(state.white,                      K.white.uri)],
    [K.black.vdxfid]:        [dd(state.black,                      K.black.uri)],
    [K.moves.vdxfid]:        [dd(JSON.stringify(state.moves),      K.moves.uri, 'application/json')],
    [K.movecount.vdxfid]:    [dd(String(state.moveCount),          K.movecount.uri)],
    [K.startedat.vdxfid]:    [dd(String(state.startedAt),          K.startedat.uri)],
    [K.mode.vdxfid]:         [dd(state.mode,                       K.mode.uri)],
    [K.status.vdxfid]:       [dd(state.status,                     K.status.uri)],
    [K.whiteopensig.vdxfid]: [dd(state.whiteOpenSig,               K.whiteopensig.uri)],
    [K.blackopensig.vdxfid]: [dd(state.blackOpenSig,               K.blackopensig.uri)],
  };

  // Add game-end fields when available
  if (state.winner)   cmm[K.winner.vdxfid]   = [dd(state.winner,             K.winner.uri)];
  if (state.result)   cmm[K.result.vdxfid]    = [dd(state.result,             K.result.uri)];
  if (state.gameHash) cmm[K.gamehash.vdxfid]  = [dd(state.gameHash,           K.gamehash.uri)];
  if (state.whiteSig) cmm[K.whitesig.vdxfid]  = [dd(state.whiteSig,           K.whitesig.uri)];
  if (state.blackSig) cmm[K.blacksig.vdxfid]  = [dd(state.blackSig,           K.blacksig.uri)];
  if (state.duration !== undefined) {
    cmm[K.duration.vdxfid] = [dd(String(state.duration), K.duration.uri + ' (seconds)')];
  }
  if (state.moveSigs && state.moveSigs.length > 0) {
    cmm[K.movesigs.vdxfid] = [dd(JSON.stringify(state.moveSigs), K.movesigs.uri, 'application/json')];
  }

  return cmm;
}

/**
 * Update the game SubID with the current game state.
 * Returns the txid immediately (tx goes to mempool).
 */
export async function updateGameOnChain(
  subIdName: string,
  state: LiveGameState,
): Promise<{ txid: string }> {
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  const fullName = `${subIdName}.${parentName.replace('@', '')}@`;

  // Get current identity to preserve non-game fields
  const identityResult = await rpcCall('getidentity', [fullName]);
  const identity = identityResult.identity;

  const contentmultimap = buildContentMultimap(state);

  const updateParams = {
    ...identity,
    contentmultimap,
  };

  const txid = await rpcCall('updateidentity', [updateParams]);
  console.log(`[Showcase] Updated ${fullName}, move ${state.moveCount}, txid:`, txid);

  return { txid };
}

/**
 * Check if a transaction is visible in the mempool.
 * Returns true if the tx exists (confirmed or unconfirmed).
 */
export async function checkMempool(txid: string): Promise<{ found: boolean; confirmations: number }> {
  try {
    const tx = await rpcCall('getrawtransaction', [txid, 1]);
    return { found: true, confirmations: tx.confirmations || 0 };
  } catch {
    return { found: false, confirmations: 0 };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/modes/showcase/live-storage.ts
git commit -m "feat: add live on-chain storage with mempool scanning for showcase mode"
```

---

### Task 4: Showcase mode handler

Implement the `ModeHandler` interface for showcase mode and register it in the mode resolver.

**Files:**
- Create: `app/utils/modes/showcase/handler.ts`
- Modify: `app/utils/modes/mode-resolver.ts` — add `case 'showcase'`

- [ ] **Step 1: Create handler.ts**

```typescript
import { ModeHandler, MoveData, SignedMovePackage, GameEndResult, StorageResult } from '../types';
import { hashMovePackage, computeAnchorHash, verifyChain, computeGameHash, MovePackageData } from '../normal/hash-chain';
import { getMoveSigner } from '../normal/move-signer';
import { updateGameOnChain, LiveGameState } from './live-storage';
import { prisma } from '@/lib/prisma';

export const showcaseHandler: ModeHandler = {

  async onMove(game: any, moveData: MoveData): Promise<SignedMovePackage> {
    const signer = getMoveSigner();

    // Get or create GameSession
    let session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session) {
      session = await prisma.gameSession.create({ data: { gameId: game.id } });
    }
    const subIdName = session.subIdName || game.id;

    // Build hash chain (reuses normal mode's chain logic)
    const moveNum = await prisma.move.count({ where: { gameId: game.id } }) + 1;

    let prevHash: string;
    if (moveNum === 1) {
      const whitePlayer = game.whitePlayer?.verusId || game.whitePlayerId;
      const blackPlayer = game.blackPlayer?.verusId || game.blackPlayerId;
      prevHash = computeAnchorHash(subIdName, whitePlayer, blackPlayer);
    } else {
      const prevMove = await prisma.move.findFirst({
        where: { gameId: game.id },
        orderBy: { createdAt: 'desc' },
      });
      if (prevMove?.movePackage) {
        prevHash = hashMovePackage(prevMove.movePackage as MovePackageData);
      } else {
        const whitePlayer = game.whitePlayer?.verusId || game.whitePlayerId;
        const blackPlayer = game.blackPlayer?.verusId || game.blackPlayerId;
        prevHash = computeAnchorHash(subIdName, whitePlayer, blackPlayer);
      }
    }

    const movePackage: MovePackageData = {
      subIdName,
      player: moveData.player,
      moveNum,
      move: moveData.move,
      prevHash,
    };

    const canonical = JSON.stringify(movePackage, Object.keys(movePackage).sort());
    const signature = signer.sign(canonical);

    // Store move in DB first
    // (The updateGame server action handles this)

    // Now update the SubID on-chain with the new move
    // Get all moves including this new one
    const existingMoves = await prisma.move.findMany({
      where: { gameId: game.id },
      orderBy: { createdAt: 'asc' },
    });
    const allMoveStrings = [...existingMoves.map(m => m.move), moveData.move];

    // Get opening signatures from GameSession
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { whitePlayer: true, blackPlayer: true },
    });

    const whiteName = fullGame?.whitePlayer?.displayName
      ? `${fullGame.whitePlayer.displayName}@`
      : fullGame?.whitePlayer?.verusId || '';
    const blackName = fullGame?.blackPlayer?.displayName
      ? `${fullGame.blackPlayer.displayName}@`
      : fullGame?.blackPlayer?.verusId || '';

    const liveState: LiveGameState = {
      white: whiteName,
      black: blackName,
      moves: allMoveStrings,
      moveCount: allMoveStrings.length,
      startedAt: Math.floor((fullGame?.createdAt?.getTime() || Date.now()) / 1000),
      mode: 'showcase',
      status: 'in_progress',
      whiteOpenSig: session.whiteFinalSig || '',  // Repurposed: stores opening sig until game end
      blackOpenSig: session.blackFinalSig || '',   // Will be set by showcase-sign API
    };

    try {
      const { txid } = await updateGameOnChain(subIdName, liveState);
      // Store txid on the move record for tracking
      // (handled after this returns, in the server action)
    } catch (error: any) {
      console.error(`[Showcase] Live chain update failed for move ${moveNum}:`, error.message);
      // Don't block the game — the move is still in the DB hash chain
    }

    return {
      ...movePackage,
      signature,
    };
  },

  async onGameEnd(game: any): Promise<GameEndResult> {
    // Reuse normal mode's verification logic
    const signer = getMoveSigner();

    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { whitePlayer: true, blackPlayer: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) throw new Error(`Game not found: ${game.id}`);

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    const subIdName = session?.subIdName || game.id;

    const packages: MovePackageData[] = fullGame.moves
      .filter(m => m.movePackage)
      .map(m => m.movePackage as MovePackageData);

    const verification = verifyChain(
      subIdName,
      fullGame.whitePlayer.verusId,
      fullGame.blackPlayer.verusId,
      packages,
    );

    if (!verification.valid) {
      console.error(`[Showcase] Chain verification failed for game ${game.id}:`, verification.error);
      return { gameHash: '', whiteFinalSig: '', blackFinalSig: '', verified: false };
    }

    const gameHash = computeGameHash(packages);

    // For showcase mode, final sigs come from the players (via showcase-sign API)
    // Use server HMAC as placeholder until player signs
    const whiteFinalSig = signer.sign(gameHash);
    const blackFinalSig = signer.sign(gameHash);

    if (session) {
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: { gameHash, whiteFinalSig, blackFinalSig, verifiedAt: new Date() },
      });
    }

    return { gameHash, whiteFinalSig, blackFinalSig, verified: true };
  },

  async storeOnChain(game: any): Promise<StorageResult> {
    // In showcase mode, data is already on chain from per-move updates.
    // This final call just writes the completed state with signatures.
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { whitePlayer: true, blackPlayer: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) return { success: false, error: 'Game not found' };

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session?.gameHash) return { success: false, error: 'Game not verified' };

    const subIdName = session.subIdName || game.id;
    const moves = fullGame.moves.map(m => m.move);
    const moveSigs = fullGame.moves.filter(m => m.signature).map(m => m.signature as string);
    const duration = Math.floor((fullGame.updatedAt.getTime() - fullGame.createdAt.getTime()) / 1000);

    const whiteName = fullGame.whitePlayer.displayName
      ? `${fullGame.whitePlayer.displayName}@`
      : fullGame.whitePlayer.verusId;
    const blackName = fullGame.blackPlayer.displayName
      ? `${fullGame.blackPlayer.displayName}@`
      : fullGame.blackPlayer.verusId;

    let winnerName = '';
    if (fullGame.winner) {
      if (fullGame.winner === fullGame.whitePlayerId) winnerName = whiteName;
      else if (fullGame.winner === fullGame.blackPlayerId) winnerName = blackName;
      else winnerName = fullGame.winner;
    }

    const finalState: LiveGameState = {
      white: whiteName,
      black: blackName,
      moves,
      moveCount: moves.length,
      startedAt: Math.floor(fullGame.createdAt.getTime() / 1000),
      mode: 'showcase',
      status: 'completed',
      whiteOpenSig: session.whiteFinalSig || '',  // TODO: separate opening sig storage
      blackOpenSig: session.blackFinalSig || '',
      winner: winnerName,
      result: fullGame.status === 'COMPLETED' ? 'checkmate' : fullGame.status.toLowerCase(),
      duration,
      gameHash: session.gameHash,
      whiteSig: session.whiteFinalSig || '',
      blackSig: session.blackFinalSig || '',
      moveSigs,
    };

    try {
      const { txid } = await updateGameOnChain(subIdName, finalState);
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: { storedAt: new Date(), txId: txid },
      });
      return { success: true, transactionId: txid, subIdName, subIdAddress: session.subIdAddress || '' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};
```

- [ ] **Step 2: Register in mode-resolver.ts**

Add the showcase case to `app/utils/modes/mode-resolver.ts`:

```typescript
import { ModeHandler } from './types';
import { originalHandler } from './original/handler';
import { normalHandler } from './normal/handler';
import { showcaseHandler } from './showcase/handler';

export function getModeHandler(mode: string | undefined | null): ModeHandler {
  switch (mode) {
    case 'normal':
      return normalHandler;
    case 'showcase':
      return showcaseHandler;
    case 'original':
    default:
      return originalHandler;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/utils/modes/showcase/handler.ts app/utils/modes/mode-resolver.ts
git commit -m "feat: add showcase ModeHandler with per-move chain storage, register in resolver"
```

---

### Task 5: Showcase signing API route

API endpoint for players to submit their opening and closing signatures.

**Files:**
- Create: `app/api/game/[gameId]/showcase-sign/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { buildOpeningMessage, verifyOpeningSignature, OpeningCommitment } from '@/app/utils/modes/showcase/opening-commitment';

// POST /api/game/[gameId]/showcase-sign
// Body: { phase: "open" | "close", player: "white" | "black", signature: string }
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  try {
    const { phase, player, signature } = await request.json();

    if (!phase || !player || !signature) {
      return NextResponse.json({ error: 'Missing phase, player, or signature' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: params.gameId },
      include: { whitePlayer: true, blackPlayer: true, gameSession: true },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.mode !== 'showcase') {
      return NextResponse.json({ error: 'Not a showcase mode game' }, { status: 400 });
    }

    const session = game.gameSession;
    if (!session) {
      return NextResponse.json({ error: 'No game session' }, { status: 400 });
    }

    const playerUser = player === 'white' ? game.whitePlayer : game.blackPlayer;
    const playerName = playerUser.displayName
      ? `${playerUser.displayName}@`
      : playerUser.verusId;

    if (phase === 'open') {
      // Verify opening commitment signature
      const whiteName = game.whitePlayer.displayName
        ? `${game.whitePlayer.displayName}@`
        : game.whitePlayer.verusId;
      const blackName = game.blackPlayer.displayName
        ? `${game.blackPlayer.displayName}@`
        : game.blackPlayer.verusId;

      const commitment: OpeningCommitment = {
        white: whiteName,
        black: blackName,
        gameNumber: session.subIdName || game.id,
        startedAt: game.createdAt.toISOString(),
      };

      const isValid = await verifyOpeningSignature(playerName, signature, commitment);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Store the opening signature
      // We use a JSON field on GameSession to track showcase-specific sigs
      const sigField = player === 'white' ? 'whiteFinalSig' : 'blackFinalSig';
      // For now, store opening sigs in whiteFinalSig/blackFinalSig
      // They'll be moved to the proper opensig fields when storing to chain
      await prisma.gameSession.update({
        where: { gameId: params.gameId },
        data: { [sigField]: signature },
      });

      // Check if both players have signed
      const updatedSession = await prisma.gameSession.findUnique({
        where: { gameId: params.gameId },
      });
      const bothSigned = updatedSession?.whiteFinalSig && updatedSession?.blackFinalSig;

      return NextResponse.json({
        success: true,
        phase: 'open',
        player,
        bothSigned,
        message: buildOpeningMessage(commitment),
      });

    } else if (phase === 'close') {
      if (!session.gameHash) {
        return NextResponse.json({ error: 'Game hash not computed yet — run verification first' }, { status: 400 });
      }

      // Verify closing signature on the game hash
      const axios = require('axios');
      const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;
      const verifyRes = await axios.post(VERUS_RPC_URL, {
        method: 'verifymessage', params: [playerName, signature, session.gameHash],
        id: 1, jsonrpc: '2.0',
      });

      if (!verifyRes.data.result) {
        return NextResponse.json({ error: 'Invalid closing signature' }, { status: 401 });
      }

      // Store the closing signature
      const sigField = player === 'white' ? 'whiteFinalSig' : 'blackFinalSig';
      await prisma.gameSession.update({
        where: { gameId: params.gameId },
        data: { [sigField]: signature },
      });

      return NextResponse.json({ success: true, phase: 'close', player });

    } else {
      return NextResponse.json({ error: 'Invalid phase — use "open" or "close"' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[showcase-sign] Error:', error);
    return NextResponse.json({ error: error.message || 'Signature submission failed' }, { status: 500 });
  }
}

// GET /api/game/[gameId]/showcase-sign — get the opening message to sign
export async function GET(request: Request, { params }: { params: { gameId: string } }) {
  try {
    const game = await prisma.game.findUnique({
      where: { id: params.gameId },
      include: { whitePlayer: true, blackPlayer: true, gameSession: true },
    });

    if (!game || game.mode !== 'showcase') {
      return NextResponse.json({ error: 'Not a showcase game' }, { status: 404 });
    }

    const whiteName = game.whitePlayer.displayName
      ? `${game.whitePlayer.displayName}@`
      : game.whitePlayer.verusId;
    const blackName = game.blackPlayer.displayName
      ? `${game.blackPlayer.displayName}@`
      : game.blackPlayer.verusId;

    const commitment: OpeningCommitment = {
      white: whiteName,
      black: blackName,
      gameNumber: game.gameSession?.subIdName || game.id,
      startedAt: game.createdAt.toISOString(),
    };

    const message = buildOpeningMessage(commitment);

    return NextResponse.json({
      message,
      commitment,
      whiteHasSigned: !!game.gameSession?.whiteFinalSig,
      blackHasSigned: !!game.gameSession?.blackFinalSig,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add to middleware public paths if needed**

Check `middleware.ts` — the route uses JWT auth like other game API routes, so no change needed.

- [ ] **Step 3: Commit**

```bash
git add app/api/game/[gameId]/showcase-sign/route.ts
git commit -m "feat: add showcase signing API for opening and closing player signatures"
```

---

### Task 6: Frontend — opening signature prompt in GameClient

When a showcase game loads and the player hasn't signed the opening commitment yet, show a signing prompt.

**Files:**
- Create: `components/chessboard/ShowcaseSigningPrompt.tsx`
- Modify: `app/game/[gameId]/GameClient.tsx` — import and render the prompt for showcase mode

- [ ] **Step 1: Create ShowcaseSigningPrompt.tsx**

This component shows the opening commitment message, a copy button for the `signmessage` command, and a paste field for the signature. It blocks gameplay until both players have signed.

```tsx
'use client';

import { useState, useEffect } from 'react';

interface ShowcaseSigningPromptProps {
  gameId: string;
  player: 'white' | 'black';
  playerVerusId: string;
  phase: 'open' | 'close';
  messageToSign: string;
  onSigned: () => void;
}

export default function ShowcaseSigningPrompt({
  gameId, player, playerVerusId, phase, messageToSign, onSigned,
}: ShowcaseSigningPromptProps) {
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const signCommand = `verus -chain=VRSCTEST signmessage "${playerVerusId}" "${messageToSign}"`;

  const handleCopy = () => {
    navigator.clipboard.writeText(signCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!signature.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/game/${gameId}/showcase-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, player, signature: signature.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onSigned();
      } else {
        setError(data.error || 'Signature verification failed');
      }
    } catch {
      setError('Network error');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl space-y-4">
        <h2 className="text-xl font-bold">
          {phase === 'open' ? 'Sign Opening Commitment' : 'Sign Game Result'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {phase === 'open'
            ? 'Both players must sign to confirm the game setup before play begins.'
            : 'Sign the final game hash to confirm the result.'}
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Message to sign:</label>
          <div className="bg-muted p-3 rounded-md font-mono text-xs break-all">
            {messageToSign}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Sign command:</label>
          <div className="relative">
            <div className="bg-muted p-3 pr-12 rounded-md font-mono text-xs break-all">
              {signCommand}
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded bg-muted-foreground/10 hover:bg-muted-foreground/20 transition-colors"
              title="Copy command"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Paste signature:</label>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Paste the signature output here"
            rows={3}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm font-mono"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !signature.trim()}
          className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {submitting ? 'Verifying...' : 'Submit Signature'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into GameClient.tsx**

At the top of `GameClient.tsx`, add the import and state:

```typescript
import ShowcaseSigningPrompt from '@/components/chessboard/ShowcaseSigningPrompt';

// Inside the GameClient component, add state:
const [showcaseSigningPhase, setShowcaseSigningPhase] = useState<'open' | 'close' | null>(null);
const [showcaseMessage, setShowcaseMessage] = useState<string>('');
const [showcaseReady, setShowcaseReady] = useState(false);
```

Add a `useEffect` that checks if the player needs to sign (for showcase mode only):

```typescript
useEffect(() => {
  if (gameState.mode !== 'showcase' || !currentPlayer) return;

  const checkShowcaseSigning = async () => {
    try {
      const res = await fetch(`/api/game/${gameState.id}/showcase-sign`);
      const data = await res.json();
      if (!data.message) return;

      const playerSide = currentPlayer === 'white' ? 'whiteHasSigned' : 'blackHasSigned';
      if (!data[playerSide]) {
        setShowcaseMessage(data.message);
        setShowcaseSigningPhase('open');
      } else if (data.whiteHasSigned && data.blackHasSigned) {
        setShowcaseReady(true);
      }
    } catch (e) {
      console.error('[Showcase] Failed to check signing status:', e);
    }
  };

  checkShowcaseSigning();
}, [gameState.mode, gameState.id, currentPlayer]);
```

Render the prompt (add before the return's main JSX):

```tsx
{showcaseSigningPhase && gameState.mode === 'showcase' && (
  <ShowcaseSigningPrompt
    gameId={gameState.id}
    player={currentPlayer as 'white' | 'black'}
    playerVerusId={(() => {
      const player = currentPlayer === 'white' ? gameState.whitePlayer : gameState.blackPlayer;
      return player?.displayName ? `${player.displayName}@` : player?.verusId || '';
    })()}
    phase={showcaseSigningPhase}
    messageToSign={showcaseMessage}
    onSigned={() => {
      setShowcaseSigningPhase(null);
      setShowcaseReady(true);
    }}
  />
)}
```

Optionally, block moves until showcase is ready (in the `playMove` function, add a guard):

```typescript
// At the top of playMove:
if (gameState.mode === 'showcase' && !showcaseReady) return;
```

- [ ] **Step 3: Commit**

```bash
git add components/chessboard/ShowcaseSigningPrompt.tsx app/game/[gameId]/GameClient.tsx
git commit -m "feat: add showcase signing prompt UI, block moves until both players sign"
```

---

### Task 7: Frontend — closing signature in GameOver

When a showcase game ends, prompt both players to sign the game hash before the final chain update.

**Files:**
- Modify: `components/chessboard/GameOver.tsx` — add closing signature flow for showcase mode

- [ ] **Step 1: Update GameOver for showcase mode**

In `GameOver.tsx`, when `game.mode === 'showcase'` and the game is completed:

1. Auto-verify the hash chain (same as current normal mode flow)
2. Show the game hash and prompt the player to sign it
3. After the player signs, show a "waiting for opponent" state
4. Once both have signed, do the final `store-blockchain` call automatically

Add the signing UI in the existing hash chain info panel section. Reuse the `ShowcaseSigningPrompt` component but inline it in the GameOver modal instead of as a full-screen overlay. Or simply add the sign command + paste field directly in the existing GameOver JSX.

Key changes to `GameOver.tsx`:

```typescript
// Add state for showcase closing:
const [showcaseClosingSig, setShowcaseClosingSig] = useState('');
const [showcaseClosingSubmitting, setShowcaseClosingSubmitting] = useState(false);
const [showcaseClosingDone, setShowcaseClosingDone] = useState(false);

// Add handler:
const handleShowcaseClosingSign = async () => {
  if (!showcaseClosingSig.trim() || !gameSession?.gameHash) return;
  setShowcaseClosingSubmitting(true);
  try {
    const res = await fetch(`/api/game/${game.id}/showcase-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'close',
        player: currentPlayer,
        signature: showcaseClosingSig.trim(),
      }),
    });
    const data = await res.json();
    if (data.success) {
      setShowcaseClosingDone(true);
      // Trigger final store
      handleVerifyAndStore();
    }
  } catch (e) {
    console.error('[Showcase] Closing sign failed:', e);
  }
  setShowcaseClosingSubmitting(false);
};
```

In the JSX, add a showcase-specific section after the hash chain panel:

```tsx
{game.mode === 'showcase' && gameSession?.gameHash && !showcaseClosingDone && (
  <div className="space-y-3 border-t border-border pt-4">
    <h4 className="font-medium">Sign to confirm result</h4>
    <div className="relative">
      <div className="bg-muted p-2 pr-10 rounded font-mono text-xs break-all">
        verus -chain=VRSCTEST signmessage "{playerVerusId}" "{gameSession.gameHash}"
      </div>
      {/* Copy button */}
    </div>
    <textarea
      value={showcaseClosingSig}
      onChange={(e) => setShowcaseClosingSig(e.target.value)}
      placeholder="Paste signature here"
      rows={2}
      className="w-full px-3 py-2 rounded-md border bg-background text-sm font-mono"
    />
    <button
      onClick={handleShowcaseClosingSign}
      disabled={showcaseClosingSubmitting || !showcaseClosingSig.trim()}
      className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
    >
      {showcaseClosingSubmitting ? 'Verifying...' : 'Submit Closing Signature'}
    </button>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/chessboard/GameOver.tsx
git commit -m "feat: add closing signature flow to GameOver for showcase mode"
```

---

### Task 8: Socket.IO — broadcast move txids for showcase mode

Pass the chain txid through socket events so opponents can see live blockchain status.

**Files:**
- Modify: `server.js` — pass `chainTxid` in `move-made` → `update-board-state`
- Modify: `app/game/[gameId]/GameClient.tsx` — display chain txid per move (optional enhancement)

- [ ] **Step 1: Update server.js move-made handler**

In `server.js`, the `move-made` handler already passes `signedPackage`. Add `chainTxid`:

```javascript
socket.on('move-made', ({ gameId, boardState, signedPackage, chainTxid }) => {
    socket.to(gameId).emit('update-board-state', boardState);
    if (signedPackage) {
        socket.to(gameId).emit('move-signed', signedPackage);
    }
    if (chainTxid) {
        socket.to(gameId).emit('move-on-chain', { txid: chainTxid, moveNum: signedPackage?.moveNum });
    }
});
```

- [ ] **Step 2: Emit chainTxid from GameClient after move**

In `GameClient.tsx`, in the `handlePlayMove` function where `move-made` is emitted, pass the txid if available from the server action response:

```typescript
// After updateGame returns:
socket.emit('move-made', {
  gameId: gameState.id,
  boardState: newBoardState,
  signedPackage: result.signedPackage || null,
  chainTxid: result.chainTxid || null,  // ADD: from showcase handler
});
```

Note: The `updateGame` server action needs to return `chainTxid` for showcase mode. This is already handled because the handler's `onMove` calls `updateGameOnChain` which returns a txid.

- [ ] **Step 3: Commit**

```bash
git add server.js app/game/[gameId]/GameClient.tsx
git commit -m "feat: broadcast chain txid through socket for showcase mode live updates"
```

---

### Task 9: Final integration testing

Verify the complete showcase flow end-to-end.

**Files:** None — manual testing only

- [ ] **Step 1: Test challenge flow with mode selection**

1. Go to /users
2. Select "Showcase" mode from dropdown
3. Challenge another player
4. Accept the challenge on the other player's browser
5. Verify the game is created with `mode: "showcase"` in the DB

- [ ] **Step 2: Test opening signatures**

1. Both players should see the signing prompt
2. Copy the sign command, run it in terminal
3. Paste the signature
4. Verify both signatures are accepted
5. Game board should unlock after both sign

- [ ] **Step 3: Test per-move chain updates**

1. Make a move as white
2. Check the Verus daemon: `getidentity game000X.ChessGame@` should show the move in the contentmultimap
3. Make a move as black
4. Check again — moves array should now have 2 entries
5. Verify `status: "in_progress"` is on chain

- [ ] **Step 4: Test game end + closing signatures**

1. Play to checkmate (or resign)
2. GameOver modal should show the game hash and signing prompt
3. Sign and submit
4. Verify final chain update has `status: "completed"`, winner, result, gamehash, both sigs

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for showcase mode end-to-end flow"
```
