# Showcase Mode — Per-Move On-Chain Storage with Player Signatures

**Date:** 2026-03-19
**Branch:** feat/signed-move-protocol
**Status:** Design approved, ready for implementation

## Overview

Showcase mode is a new `ModeHandler` that stores every move on-chain in real time during gameplay. It uses mempool scanning for fast move propagation and bookends the game with player signatures — one at game start (opening commitment) and one at game end (final confirmation).

This is a completely new mode handler. It does NOT modify any existing normal, tournament, or original mode code.

## Design Decisions

- **Flat VDXF key namespace:** Reuses all existing `chessgame::game.v1.*` keys. Adds 3 new keys: `whiteopensig`, `blackopensig`, `status`. The `mode` field value is `"showcase"`.
- **Server submits all transactions** under `ChessGame@` — players don't need funded wallets or UTXO management.
- **Players sign twice:** once at game start (opening commitment via `signmessage`) and once at game end (final game hash). No per-move signing — avoids UX friction without a MetaMask-style extension.
- **Mempool-based move delivery:** Server submits `updateidentity` for each move and immediately scans the mempool for the txid. The opponent's client sees the move via mempool data, not waiting for block confirmation.
- **SubID updated each move:** The game SubID (`game000X.ChessGame@`) contentmultimap is rewritten with the full move list on every move. This is simple and keeps all data on the SubID.

## Game Lifecycle

### 1. Game Start — Opening Commitment

Both players sign an opening commitment message that locks in the game parameters:

```
Canonical message (sorted JSON):
{
  "black": "lenny@",
  "gameNumber": "game0009",
  "startedAt": "2026-03-19T15:45:00Z",
  "white": "alice@"
}
```

Each player signs this via `verus -chain=VRSCTEST signmessage "player@" "<message>"`. The frontend shows the message and a copy button (same UX as login). Both signatures are collected before the game begins.

The server:
1. Creates the SubID via `registernamecommitment` + `registeridentity` (or uses pre-registered commitment from game creation)
2. Writes the initial contentmultimap to the SubID with:
   - `white`, `black`, `startedat`, `mode: "showcase"`, `status: "in_progress"`
   - `whiteopensig`, `blackopensig` (the opening commitment signatures)
   - `moves: []`, `movecount: 0`

### 2. Each Move — Live On-Chain Update

When a player makes a move:

1. Server builds the updated contentmultimap (full move list + incremented movecount)
2. Calls `updateidentity` on the game SubID
3. Gets `txid` back immediately
4. Scans mempool via `getrawmempool` or `getrawtransaction [txid, 1]` to confirm the tx is in mempool
5. Broadcasts the move + txid to the opponent via Socket.IO
6. Opponent's client can independently verify by checking the mempool for the txid

The SubID contentmultimap grows with each move but remains small (a few KB for a full game).

### 3. Game End — Final Signatures

When the game concludes (checkmate, resignation, stalemate):

1. Server computes the final game hash from the hash chain (same as normal mode)
2. Both players are prompted to sign the game hash via `signmessage`
3. Server verifies both signatures via `verifymessage`
4. Final `updateidentity` writes the complete record:
   - All shared fields (winner, result, gamehash, duration, etc.)
   - `whitesig`, `blacksig` (final signatures on game hash)
   - `status: "completed"`
   - `movesigs` (per-move server HMAC signatures from the hash chain)

### 4. Optional — Store to Player's Own ID

After the game is finalized, either player can click "Store to my ID" to copy the game record onto their own VerusID's contentmultimap. This is a separate `updateidentity` call targeting the player's identity instead of the game SubID.

This requires the player to have signing authority over their own identity (their WIF key configured or browser extension). This is a stretch goal and can be deferred.

## VDXF Keys

All 17 keys are published on ChessGame@'s contentmultimap as DefinedKeys.

### Shared keys (used by all modes)

| Field | URI | vdxfid |
|---|---|---|
| version | `chessgame::game.v1.version` | `i68daedRarsq5o8XAyqtDoLNKFsnPbHfy3` |
| white | `chessgame::game.v1.white` | `iHQYL4kHxcppiFHNPKfQnUqGUpqXW1rGje` |
| black | `chessgame::game.v1.black` | `iNywJcF2dSwbQzzNw2s92obHLrebuFoqvX` |
| winner | `chessgame::game.v1.winner` | `i6YXjwdUmQPP8VcswDqAdX2VfCtfokqcqq` |
| result | `chessgame::game.v1.result` | `i4xV1gwrsQWK8smrqzhUxGiCb7M4fNWeQm` |
| moves | `chessgame::game.v1.moves` | `i8xnxTewAa4jGfL2qxHGCzN9oni7XLTg2y` |
| movecount | `chessgame::game.v1.movecount` | `iMPovQC9LMr8f9AQi3fNnuJaywVnYvKY9L` |
| duration | `chessgame::game.v1.duration` | `i7huWK1jULuZz4uw1FuEoVhX7XrSuGbV8M` |
| startedat | `chessgame::game.v1.startedat` | `iBwYB8M81jj6BaQZ3gF2gs5jH2f9oDWqKB` |
| gamehash | `chessgame::game.v1.gamehash` | `i5DTzWhVndJN2LK7aKYa6AHRufKCkjrGaF` |
| whitesig | `chessgame::game.v1.whitesig` | `iBRVxYHAk2iwbPvoX7Ra5VqjwyZanhS9YT` |
| blacksig | `chessgame::game.v1.blacksig` | `iEV6cVwMx6MqoKa9d4UMrvvpAHvnzuyJnA` |
| mode | `chessgame::game.v1.mode` | `i7m9fT6XCANjEEfH22tusdzkNGeF5Bn721` |
| movesigs | `chessgame::game.v1.movesigs` | `iJeeGG5tHwd8wNUkjrVG2UeVwd7ScfYFRu` |

### Showcase-specific keys

| Field | URI | vdxfid |
|---|---|---|
| whiteopensig | `chessgame::game.v1.whiteopensig` | `iQWko8qaxzM2UE8dPEUkDK5gNm81H1EuYt` |
| blackopensig | `chessgame::game.v1.blackopensig` | `i6xRQNvbDcqEGvZWi92bTLnHsu8RHLzhGy` |
| status | `chessgame::game.v1.status` | `i847veVEmYxjYmUzfGVemAk7y2bAHrViSn` |

## Architecture — New Files Only

All showcase mode code lives in `app/utils/modes/showcase/`. No existing files are modified except:
- `mode-resolver.ts` — add `case 'showcase'` (one line)
- `vdxf-keys.ts` — already updated with the 3 new keys

### New files

```
app/utils/modes/showcase/
  handler.ts           — ModeHandler implementation (onMove, onGameEnd, storeOnChain)
  live-storage.ts      — per-move updateidentity + mempool scanning
  opening-commitment.ts — builds canonical opening message, verifies player signatures
```

### API changes

- `POST /api/game` — accept `mode: "showcase"` (already works, mode is passed through)
- `POST /api/game/[gameId]/showcase-sign` — NEW: endpoint for players to submit opening/closing signatures
- The existing `store-blockchain` and `store-move-blockchain` routes are NOT touched. Showcase mode handles its own storage through the `ModeHandler` hooks.

### Frontend changes

- `GameClient.tsx` — when mode is `"showcase"`, show a signing prompt before the first move (opening commitment) and after game end (final signature). Copy button for the signmessage command, paste field for the signature.
- `GameOver.tsx` — when mode is `"showcase"`, show final signing prompt instead of the current "Verify & Store" button. Once both signatures are in, the final update happens automatically.

## Mempool Scanning Strategy

When the server submits an `updateidentity` tx for a move:

1. `updateidentity` returns the txid immediately
2. Server calls `getrawtransaction [txid, 1]` — if the tx is in mempool, it returns with `confirmations: 0`
3. Server emits `move-stored` via Socket.IO with `{ txid, moveNum }`
4. Opponent's client can verify by calling `getrawtransaction` themselves (optional, for display)

For the NEXT move, the server needs the previous tx's output as input. Since `updateidentity` manages UTXOs internally, the daemon handles this — we just call `updateidentity` again and it chains off the mempool tx.

If a tx gets stuck (rejected from mempool), the server falls back to waiting for the previous tx to confirm before retrying.

## Isolation Guarantees

- Showcase mode implements `ModeHandler` — same interface as normal and original
- All showcase code is in `app/utils/modes/showcase/` — no cross-contamination
- Existing normal/tournament games continue to work exactly as before
- The mode resolver dispatches by string value — adding `"showcase"` doesn't affect other cases
- The shared VDXF keys are read-only constants — showcase just uses additional ones
- The chain-reader already handles all 17 keys generically via the key lookup
