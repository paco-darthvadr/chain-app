# SubID Pre-Registration Pool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pre-register a pool of game SubIDs on-chain so showcase mode games can start instantly without waiting for commitment mining.

**Architecture:** New Prisma model `SubIdPool` tracks pre-registered SubIDs. A pool manager ensures 5+ SubIDs are always ready. When a showcase game starts, it pops a ready SubID instead of registering one on-the-fly. After use, background replenishment kicks off.

**Tech Stack:** Prisma/SQLite, Verus RPC (registernamecommitment, registeridentity, getidentity), Next.js API routes

**Spec:** See `docs/superpowers/specs/2026-03-19-showcase-mode-design.md` for showcase mode context

---

### Task 1: Add SubIdPool schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Add the SubIdPool model:

```prisma
model SubIdPool {
  id          String   @id @default(cuid())
  subIdName   String   @unique  // "game0017"
  gameNumber  Int      @unique  // 17
  address     String?            // i-address once registered
  status      String   @default("registering") // "registering" | "ready" | "used"
  commitTxId  String?            // registernamecommitment txid
  createdAt   DateTime @default(now())
  usedAt      DateTime?
  usedByGameId String?           // links to Game.id when assigned
}
```

- [ ] Run `DATABASE_URL="file:./dev.db" npx prisma db push --skip-generate`
- [ ] Run `npx prisma generate`
- [ ] Commit

---

### Task 2: Create pool manager utility

**Files:**
- Create: `app/utils/subid-pool.ts`

This module:
1. `getPoolStatus()` — returns count of ready/registering/used SubIDs
2. `popReadySubId()` — atomically claims the lowest-numbered 'ready' SubID, marks as 'used', returns it
3. `ensurePoolSize(minSize = 5)` — checks how many 'ready' + 'registering' SubIDs exist. If fewer than minSize, kicks off background registration for the difference.
4. `registerOneSubId()` — picks the next game number from GameCounter, does the full two-step registration (registernamecommitment → wait → registeridentity), updates SubIdPool status from 'registering' to 'ready'.

Key details:
- Uses the existing `GameCounter` singleton for sequential numbering (shared with normal mode)
- `popReadySubId` must be atomic — use Prisma's `updateMany` with `where: { status: 'ready' }` + `orderBy: { gameNumber: 'asc' }` + `take: 1`
- `registerOneSubId` runs the same RPC calls as `createGameSubId` in `subid-storage.ts` but updates SubIdPool instead of GameSession
- All registration is async/background — never blocks request handlers

- [ ] Create the file with all 4 functions
- [ ] Commit

---

### Task 3: Wire pool into showcase game creation

**Files:**
- Modify: `app/api/game/route.ts`

Currently for showcase mode, the route:
1. Increments GameCounter
2. Creates GameSession with subIdName
3. Fire-and-forget registernamecommitment

Change to:
1. Call `popReadySubId()` from the pool
2. If a ready SubID is available: use its `subIdName` and `address` for the GameSession (SubID already exists on-chain!)
3. If pool is empty: fall back to the current behavior (increment counter, fire-and-forget commitment)
4. After popping, call `ensurePoolSize()` in background to replenish

- [ ] Update the showcase branch in POST /api/game
- [ ] Commit

---

### Task 4: Wire pool into showcase handler

**Files:**
- Modify: `app/utils/modes/showcase/handler.ts`

Currently `onMove` checks `session.subIdAddress` and calls `createGameSubId` if missing. With the pool, the SubID should already be created at game start (Task 3). But as a safety net:

1. If `session.subIdAddress` exists → skip creation, go straight to `updateGameOnChain`
2. If `session.subIdAddress` is null → call `createGameSubId` as fallback (existing behavior)

Also update `storeOnChain` to use `session.subIdAddress` directly without re-creating.

- [ ] Update onMove and storeOnChain
- [ ] Commit

---

### Task 5: Pool replenishment API/startup

**Files:**
- Create: `app/api/pool/route.ts`

A simple API endpoint:
- `GET /api/pool` — returns pool status (ready count, registering count, total)
- `POST /api/pool/replenish` — triggers `ensurePoolSize()` manually

Also add pool initialization on server startup. In `server.js`, after the Socket.IO server starts, make an HTTP call to `POST /api/pool/replenish` to ensure the pool has SubIDs ready.

- [ ] Create the API route
- [ ] Add startup call in server.js
- [ ] Commit

---

### Task 6: Test end-to-end

- [ ] Start server, verify pool starts registering 5 SubIDs
- [ ] Wait for SubIDs to be confirmed (check via `getidentity`)
- [ ] Start a showcase game — should instantly get a SubID from pool
- [ ] Play moves — per-move `updateidentity` should work on first move
- [ ] Finish game — closing signatures + final store should work
- [ ] Check pool replenished after game
