# Board Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 selectable board color themes with Verus logo watermark, chosen by the challenger in a popup modal before sending a challenge.

**Architecture:** Theme config objects define colors. Chessboard renders via CSS custom properties instead of hardcoded colors. A logo overlay `<img>` is positioned center-board with configurable opacity. A `ChallengeModal` replaces the inline mode dropdown. Two new DB columns (`boardTheme`, `logoMode`) on the Game model flow through sockets and API.

**Tech Stack:** Next.js 14, React, Prisma/SQLite, Socket.IO, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-20-board-themes-design.md`

---

### Task 1: Theme config and types

**Files:**
- Create: `app/utils/board-themes.ts`

- [ ] **Step 1: Create the theme config file**

```ts
// app/utils/board-themes.ts

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

export const VALID_LOGO_MODES: LogoMode[] = ['off', 'faded', 'centered'];

export function getTheme(id: string): BoardTheme {
  return BOARD_THEMES.find(t => t.id === id) || BOARD_THEMES[0];
}

export function isValidThemeId(id: string): boolean {
  return BOARD_THEMES.some(t => t.id === id);
}

export function isValidLogoMode(mode: string): mode is LogoMode {
  return VALID_LOGO_MODES.includes(mode as LogoMode);
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit app/utils/board-themes.ts 2>&1 || echo "Check imports"`
Expected: No errors (standalone file with no imports)

- [ ] **Step 3: Commit**

```bash
git add app/utils/board-themes.ts
git commit -m "feat: add board theme config with 10 themes and validation helpers"
```

---

### Task 2: Database schema changes

**Files:**
- Modify: `prisma/schema.prisma` (Game model, lines 25-48)

- [ ] **Step 1: Add boardTheme and logoMode columns to Game model**

In `prisma/schema.prisma`, add two lines inside the `Game` model, after the `mode` field (line 39):

```prisma
  boardTheme String   @default("classic")  // board color theme id
  logoMode   String   @default("off")      // "off" | "faded" | "centered"
```

- [ ] **Step 2: Run Prisma push and generate**

Run: `npx prisma db push && npx prisma generate`
Expected: Output includes "Your database is now in sync" and "Generated Prisma Client"

Existing games get `"classic"` and `"off"` defaults automatically.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add boardTheme and logoMode columns to Game model"
```

---

### Task 3: Download Verus logo asset

**Files:**
- Create: `public/img/verus-icon-white.svg`

- [ ] **Step 1: Download the Verus icon SVG from GitHub**

```bash
curl -L "https://raw.githubusercontent.com/VerusCoin/Media-Assets/master/verus-icon-white.svg" -o /home/cinnamint2/code/chess/chain-app/public/img/verus-icon-white.svg
```

- [ ] **Step 2: Verify the file downloaded correctly**

Run: `file public/img/verus-icon-white.svg && head -5 public/img/verus-icon-white.svg`
Expected: SVG file with `<svg` tag visible

If the download fails (404 or wrong path), check the repo at https://github.com/VerusCoin/Media-Assets for the correct filename and path. The file may be in a subdirectory like `SVG/` or `Icons/`.

- [ ] **Step 3: Commit**

```bash
git add public/img/verus-icon-white.svg
git commit -m "feat: add Verus icon SVG asset for board watermark"
```

---

### Task 4: Update Chessboard CSS to use CSS variables

**Files:**
- Modify: `components/chessboard/Chessboard.css`

- [ ] **Step 1: Replace hardcoded tile colors with CSS variables**

In `components/chessboard/Chessboard.css`, replace the `.black-tile` and `.white-tile` rules (lines 18-24):

Old:
```css
#chessboard .black-tile {
    background-color: #606956;
}

#chessboard .white-tile {
    background-color: #ebecd0;
}
```

New:
```css
#chessboard .black-tile {
    background-color: var(--square-dark, #606956);
}

#chessboard .white-tile {
    background-color: var(--square-light, #ebecd0);
}
```

- [ ] **Step 2: Fix the valid-move rule to use an overlay instead of replacing background**

The current `.valid-move` rule (line 26-28) replaces the tile background entirely. Change it to use `box-shadow` inset so the theme color shows through:

Old:
```css
#chessboard .tile.valid-move {
    background-color: rgba(0, 255, 0, 0.2);
}
```

New:
```css
#chessboard .tile.valid-move {
    box-shadow: inset 0 0 0 100px rgba(0, 255, 0, 0.2);
}
```

- [ ] **Step 3: Verify the board still renders correctly**

Run: `npx next dev -p 3000` and open http://localhost:3000, navigate to a game.
Expected: Board looks identical to before (CSS variable fallbacks match the old hardcoded values).

- [ ] **Step 4: Commit**

```bash
git add components/chessboard/Chessboard.css
git commit -m "feat: switch board tile colors to CSS variables with fallbacks"
```

---

### Task 5: Update Chessboard component to accept theme props and render logo

**Files:**
- Modify: `components/chessboard/Chessboard.tsx`

- [ ] **Step 1: Add imports and update Props interface**

At the top of `components/chessboard/Chessboard.tsx`, add the import (after existing imports, around line 6):

```ts
import { getTheme, LogoMode } from '@/app/utils/board-themes';
```

Update the `Props` interface (lines 10-14):

Old:
```ts
interface Props {
    playMove: (piece: Piece, position: Position) => boolean;
    pieces: Piece[];
    bottomColor?: 'white' | 'black';
}
```

New:
```ts
interface Props {
    playMove: (piece: Piece, position: Position) => boolean;
    pieces: Piece[];
    bottomColor?: 'white' | 'black';
    boardTheme?: string;
    logoMode?: LogoMode;
}
```

- [ ] **Step 2: Update the component signature and add theme lookup**

Update the function signature (line 19):

Old:
```ts
export default function Chessboard({ pieces, playMove, bottomColor = 'white' }: Props) {
```

New:
```ts
export default function Chessboard({ pieces, playMove, bottomColor = 'white', boardTheme = 'classic', logoMode = 'off' }: Props) {
```

Add theme lookup right after the existing useState hooks (after line 22):

```ts
    const theme = getTheme(boardTheme);
```

- [ ] **Step 3: Set CSS custom properties on the board container**

Update the `#chessboard` div (lines 245-253) to include CSS variables:

Old:
```tsx
                    <div
                        id="chessboard"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(8, 1fr)',
                            width: GRID_SIZE * 8,
                            height: GRID_SIZE * 8
                        }}
                    >
                        {board}
                    </div>
```

New:
```tsx
                    <div
                        id="chessboard"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(8, 1fr)',
                            width: GRID_SIZE * 8,
                            height: GRID_SIZE * 8,
                            '--square-light': theme.lightSquare,
                            '--square-dark': theme.darkSquare,
                            position: 'relative',
                        } as React.CSSProperties}
                    >
                        {board}
                        {logoMode !== 'off' && (
                            <img
                                src="/img/verus-icon-white.svg"
                                alt=""
                                style={{
                                    position: 'absolute',
                                    top: GRID_SIZE * 3,
                                    left: GRID_SIZE * 3,
                                    width: GRID_SIZE * 2,
                                    height: GRID_SIZE * 2,
                                    opacity: logoMode === 'faded' ? 0.1 : 0.4,
                                    pointerEvents: 'none',
                                    filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))',
                                    zIndex: 1,
                                }}
                            />
                        )}
                    </div>
```

Note: The `as React.CSSProperties` cast is needed because TypeScript doesn't know about CSS custom properties. The `drop-shadow` filter helps the white logo remain visible on light-square themes.

- [ ] **Step 4: Verify the board renders with default theme**

Run the dev server and open a game. The board should look identical to before (classic theme, no logo).

- [ ] **Step 5: Commit**

```bash
git add components/chessboard/Chessboard.tsx
git commit -m "feat: Chessboard accepts boardTheme and logoMode props, renders logo overlay"
```

---

### Task 6: Wire theme from Game data through GameClient to Chessboard

**Files:**
- Modify: `app/game/[gameId]/GameClient.tsx` (line 686)

- [ ] **Step 1: Pass theme props from GameClient to Chessboard**

In `app/game/[gameId]/GameClient.tsx`, find the Chessboard rendering (line 686):

Old:
```tsx
                        <Chessboard pieces={board.pieces} playMove={playMove} bottomColor={currentPlayer} />
```

New:
```tsx
                        <Chessboard pieces={board.pieces} playMove={playMove} bottomColor={currentPlayer} boardTheme={gameState.boardTheme || 'classic'} logoMode={gameState.logoMode || 'off'} />
```

The `gameState` is initialized from `game` prop (which comes from the Prisma query). Since we added `boardTheme` and `logoMode` to the Game model, these fields will be present in the API response.

- [ ] **Step 2: Commit**

```bash
git add app/game/[gameId]/GameClient.tsx
git commit -m "feat: pass boardTheme and logoMode from game data to Chessboard"
```

---

### Task 7: Update game creation API to accept and validate theme fields

**Files:**
- Modify: `app/api/game/route.ts` (lines 27-53)

- [ ] **Step 1: Update POST handler to accept boardTheme and logoMode**

In `app/api/game/route.ts`, add the import at the top (after existing imports, around line 7):

```ts
import { isValidThemeId, isValidLogoMode } from '@/app/utils/board-themes';
```

Update the destructuring and game creation (starting at line 29):

Old:
```ts
        const { whitePlayerId, blackPlayerId, mode } = await req.json();

        if (!whitePlayerId || !blackPlayerId) {
            return new NextResponse('Missing player IDs', { status: 400 });
        }

        const initialBoardState = {
            pieces: initialPieces,
            totalTurns: 0,
            currentTeam: 'w',
            winningTeam: null,
            capturedPieces: [],
        };

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
```

New:
```ts
        const { whitePlayerId, blackPlayerId, mode, boardTheme, logoMode } = await req.json();

        if (!whitePlayerId || !blackPlayerId) {
            return new NextResponse('Missing player IDs', { status: 400 });
        }

        const initialBoardState = {
            pieces: initialPieces,
            totalTurns: 0,
            currentTeam: 'w',
            winningTeam: null,
            capturedPieces: [],
        };

        const gameMode = mode || 'normal';
        const validTheme = (boardTheme && isValidThemeId(boardTheme)) ? boardTheme : 'classic';
        const validLogoMode = (logoMode && isValidLogoMode(logoMode)) ? logoMode : 'off';

        const newGame = await prisma.game.create({
            data: {
                whitePlayerId,
                blackPlayerId,
                boardState: initialBoardState,
                status: 'IN_PROGRESS',
                mode: gameMode,
                boardTheme: validTheme,
                logoMode: validLogoMode,
            },
        });
```

- [ ] **Step 2: Commit**

```bash
git add app/api/game/route.ts
git commit -m "feat: game creation API accepts and validates boardTheme and logoMode"
```

---

### Task 8: Update socket server to relay theme fields

**Files:**
- Modify: `server.js` (lines 77-94 challenge handler, lines 182-218 rematch handler)

- [ ] **Step 1: Update challenge-user handler to relay boardTheme and logoMode**

In `server.js`, update the `challenge-user` handler (around line 77):

Old:
```js
  socket.on('challenge-user', ({ challengerId, challengerName, challengeeId, mode }) => {
    console.log(`Challenge attempt: ${challengerName} (${challengerId}) challenging ${challengeeId}`);
    console.log('Available users:', Object.keys(userSockets));

    const challengeeSockets = userSockets[challengeeId];
    if (challengeeSockets && challengeeSockets.size > 0) {
        console.log(`Sending challenge to ${challengeeId} on ${challengeeSockets.size} socket(s)`);
        for (const sid of challengeeSockets) {
            io.to(sid).emit('new-challenge', {
                challengerId: challengerId,
                challengerName: challengerName,
                mode: mode
            });
        }
```

New:
```js
  socket.on('challenge-user', ({ challengerId, challengerName, challengeeId, mode, boardTheme, logoMode }) => {
    console.log(`Challenge attempt: ${challengerName} (${challengerId}) challenging ${challengeeId}`);
    console.log('Available users:', Object.keys(userSockets));

    const challengeeSockets = userSockets[challengeeId];
    if (challengeeSockets && challengeeSockets.size > 0) {
        console.log(`Sending challenge to ${challengeeId} on ${challengeeSockets.size} socket(s)`);
        for (const sid of challengeeSockets) {
            io.to(sid).emit('new-challenge', {
                challengerId: challengerId,
                challengerName: challengerName,
                mode: mode,
                boardTheme: boardTheme || 'classic',
                logoMode: logoMode || 'off'
            });
        }
```

- [ ] **Step 2: Update rematch-accept handler to carry over boardTheme and logoMode**

In `server.js`, update the `rematch-accept` handler (around line 199):

Old:
```js
      const newGameData = {
        whitePlayerId: white,
        blackPlayerId: black,
        mode: originalGame.mode || 'normal',
      };
```

New:
```js
      const newGameData = {
        whitePlayerId: white,
        blackPlayerId: black,
        mode: originalGame.mode || 'normal',
        boardTheme: originalGame.boardTheme || 'classic',
        logoMode: originalGame.logoMode || 'off',
      };
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: relay boardTheme and logoMode in challenge and rematch socket events"
```

---

### Task 9: Create ChallengeModal component

**Files:**
- Create: `components/chessboard/ChallengeModal.tsx`

- [ ] **Step 1: Create the ChallengeModal component**

```tsx
// components/chessboard/ChallengeModal.tsx
'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { BOARD_THEMES, BoardTheme, LogoMode } from '@/app/utils/board-themes';

interface ChallengeModalProps {
  targetUser: { id: string; displayName: string | null; verusId: string };
  onConfirm: (settings: { mode: string; boardTheme: string; logoMode: LogoMode }) => void;
  onClose: () => void;
}

function MiniBoard({ theme, logoMode }: { theme: BoardTheme; logoMode: LogoMode }) {
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      squares.push(
        <div
          key={`${r}-${c}`}
          style={{
            backgroundColor: (r + c) % 2 === 0 ? theme.lightSquare : theme.darkSquare,
          }}
        />
      );
    }
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(8, 1fr)',
      aspectRatio: '1',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '2px solid transparent',
      position: 'relative',
    }}>
      {squares}
      {logoMode !== 'off' && (
        <img
          src="/img/verus-icon-white.svg"
          alt=""
          style={{
            position: 'absolute',
            top: '25%',
            left: '25%',
            width: '50%',
            height: '50%',
            opacity: logoMode === 'faded' ? 0.1 : 0.4,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.3))',
          }}
        />
      )}
    </div>
  );
}

export default function ChallengeModal({ targetUser, onConfirm, onClose }: ChallengeModalProps) {
  const [mode, setMode] = useState<string>('normal');
  const [selectedTheme, setSelectedTheme] = useState<string>('classic');
  const [logoMode, setLogoMode] = useState<LogoMode>('off');

  const handleConfirm = () => {
    onConfirm({ mode, boardTheme: selectedTheme, logoMode });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-xl border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">
          Challenge {targetUser.displayName || targetUser.verusId}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Configure your game settings</p>

        {/* Mode Picker */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Game Mode</label>
          <div className="flex gap-2">
            <Button
              variant={mode === 'normal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('normal')}
            >
              Normal
            </Button>
            <Button
              variant={mode === 'showcase' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('showcase')}
            >
              Showcase
            </Button>
          </div>
          {mode === 'showcase' && (
            <p className="text-xs text-amber-400 mt-1">Every move stored on-chain live</p>
          )}
        </div>

        {/* Logo Toggle */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Verus Logo</label>
          <div className="flex gap-2">
            {(['off', 'faded', 'centered'] as LogoMode[]).map((lm) => (
              <Button
                key={lm}
                variant={logoMode === lm ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLogoMode(lm)}
              >
                {lm.charAt(0).toUpperCase() + lm.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Board Theme</label>
          <div className="grid grid-cols-5 gap-2">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className="text-left"
                style={{
                  border: selectedTheme === theme.id ? '2px solid #3165D4' : '2px solid transparent',
                  borderRadius: '6px',
                  padding: '4px',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <MiniBoard theme={theme} logoMode={logoMode} />
                <p className="text-xs text-center mt-1 truncate">{theme.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Send Challenge
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to ChallengeModal

- [ ] **Step 3: Commit**

```bash
git add components/chessboard/ChallengeModal.tsx
git commit -m "feat: add ChallengeModal with mode picker, logo toggle, and theme grid"
```

---

### Task 10: Wire ChallengeModal into users page

**Files:**
- Modify: `app/users/page.tsx`

This task replaces the inline mode dropdown with the ChallengeModal and updates all challenge/accept flows to include `boardTheme` and `logoMode`.

- [ ] **Step 1: Add import and state for ChallengeModal**

In `app/users/page.tsx`, add the import (after existing imports, around line 14):

```ts
import ChallengeModal from '@/components/chessboard/ChallengeModal';
```

In the component state declarations (around lines 30-40), add a new state and remove `selectedMode`:

Remove this line:
```ts
    const [selectedMode, setSelectedMode] = useState<string>('normal');
```

Add:
```ts
    const [challengeTarget, setChallengeTarget] = useState<User | null>(null);
```

- [ ] **Step 2: Update incomingChallenge state type**

Update line 37:

Old:
```ts
    const [incomingChallenge, setIncomingChallenge] = useState<{ challengerId: string, challengerName: string, mode?: string } | null>(null);
```

New:
```ts
    const [incomingChallenge, setIncomingChallenge] = useState<{ challengerId: string, challengerName: string, mode?: string, boardTheme?: string, logoMode?: string } | null>(null);
```

- [ ] **Step 3: Update the new-challenge socket listener**

Update the socket listener (around line 93):

Old:
```ts
        socket.on('new-challenge', ({ challengerId, challengerName, mode }) => {
            const currentUser = localStorage.getItem('currentUser');
            if (challengerId !== currentUser) {
                setIncomingChallenge({ challengerId, challengerName, mode });
            }
        });
```

New:
```ts
        socket.on('new-challenge', ({ challengerId, challengerName, mode, boardTheme, logoMode }) => {
            const currentUser = localStorage.getItem('currentUser');
            if (challengerId !== currentUser) {
                setIncomingChallenge({ challengerId, challengerName, mode, boardTheme, logoMode });
            }
        });
```

- [ ] **Step 4: Replace handleChallenge with modal open**

Replace the `handleChallenge` function (lines 139-153):

Old:
```ts
    const handleChallenge = async (opponentId: string) => {
        if (!currentUserId) return alert("Please select your user identity first.");
        if (!socket) return alert("Not connected to server. Please wait.");

        const currentUser = users.find(u => u.id === currentUserId);
        if (!currentUser) return alert("Could not find your user data.");

        socket.emit('challenge-user', {
            challengerId: currentUserId,
            challengerName: currentUser.displayName || currentUser.verusId,
            challengeeId: opponentId,
            mode: selectedMode,
        });
        setChallengeSent(opponentId);
    };
```

New:
```ts
    const handleOpenChallenge = (user: User) => {
        if (!currentUserId) return alert("Please select your user identity first.");
        if (!socket) return alert("Not connected to server. Please wait.");
        setChallengeTarget(user);
    };

    const handleConfirmChallenge = ({ mode, boardTheme, logoMode }: { mode: string; boardTheme: string; logoMode: string }) => {
        if (!currentUserId || !socket || !challengeTarget) return;

        const currentUser = users.find(u => u.id === currentUserId);
        if (!currentUser) return alert("Could not find your user data.");

        socket.emit('challenge-user', {
            challengerId: currentUserId,
            challengerName: currentUser.displayName || currentUser.verusId,
            challengeeId: challengeTarget.id,
            mode,
            boardTheme,
            logoMode,
        });
        setChallengeSent(challengeTarget.id);
        setChallengeTarget(null);
    };
```

- [ ] **Step 5: Update handleAcceptChallenge to forward theme fields**

Update `handleAcceptChallenge` (lines 155-190), specifically the fetch body:

Old:
```ts
                body: JSON.stringify({
                    ...(Math.random() < 0.5
                        ? { whitePlayerId: incomingChallenge.challengerId, blackPlayerId: currentUserId }
                        : { whitePlayerId: currentUserId, blackPlayerId: incomingChallenge.challengerId }),
                    mode: incomingChallenge.mode || 'normal',
                }),
```

New:
```ts
                body: JSON.stringify({
                    ...(Math.random() < 0.5
                        ? { whitePlayerId: incomingChallenge.challengerId, blackPlayerId: currentUserId }
                        : { whitePlayerId: currentUserId, blackPlayerId: incomingChallenge.challengerId }),
                    mode: incomingChallenge.mode || 'normal',
                    boardTheme: incomingChallenge.boardTheme || 'classic',
                    logoMode: incomingChallenge.logoMode || 'off',
                }),
```

- [ ] **Step 6: Update the incoming challenge popup to show theme name**

Update the incoming challenge popup (lines 223-239). Replace the existing mode display and add theme info:

Old:
```tsx
                        {incomingChallenge.mode === 'showcase' && (
                            <p className="text-sm text-amber-400 mb-4">Mode: Showcase (every move stored on-chain live)</p>
                        )}
```

New:
```tsx
                        <div className="text-sm text-muted-foreground mb-4 space-y-1">
                            {incomingChallenge.mode === 'showcase' && (
                                <p className="text-amber-400">Mode: Showcase (every move stored on-chain live)</p>
                            )}
                            {incomingChallenge.boardTheme && incomingChallenge.boardTheme !== 'classic' && (
                                <p>Board: {incomingChallenge.boardTheme.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                            )}
                        </div>
```

- [ ] **Step 7: Remove inline mode dropdown, add ChallengeModal render**

Remove the entire mode selector block (lines 325-335):

```tsx
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

Update the Challenge button (around line 351) to open the modal instead:

Old:
```tsx
                                        <Button
                                            onClick={() => handleChallenge(user.id)}
                                            disabled={isLoading || isDeleting || challengeSent === user.id || !!incomingChallenge}
                                        >
                                            {challengeSent === user.id ? 'Sent' : 'Challenge'}
                                        </Button>
```

New:
```tsx
                                        <Button
                                            onClick={() => handleOpenChallenge(user)}
                                            disabled={isLoading || isDeleting || challengeSent === user.id || !!incomingChallenge}
                                        >
                                            {challengeSent === user.id ? 'Sent' : 'Challenge'}
                                        </Button>
```

Add the ChallengeModal render just before the closing `</DashboardLayout>` tag:

```tsx
            {challengeTarget && (
                <ChallengeModal
                    targetUser={challengeTarget}
                    onConfirm={handleConfirmChallenge}
                    onClose={() => setChallengeTarget(null)}
                />
            )}
```

- [ ] **Step 8: Verify the page compiles and modal opens**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors

Run dev server and navigate to users page. Click "Challenge" on a user.
Expected: Modal opens with mode picker, logo toggle, and 10 theme previews.

- [ ] **Step 9: Commit**

```bash
git add app/users/page.tsx
git commit -m "feat: replace inline mode dropdown with ChallengeModal popup"
```

---

### Task 11: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Start the servers**

```bash
# Terminal 1
node server.js

# Terminal 2
npx next dev -p 3000
```

- [ ] **Step 2: Test challenge flow with theme**

1. Open http://localhost:3000 in two browsers (or incognito)
2. Log in as two different users
3. Click "Challenge" on opponent → verify modal opens
4. Select "Showcase" mode, "Faded" logo, "Verus Bright" theme → click "Send Challenge"
5. Opponent sees challenge popup with theme name displayed
6. Opponent accepts → both redirected to game
7. Verify: board renders in Verus Bright colors (blue/white)
8. Verify: faded Verus logo visible center-board

- [ ] **Step 3: Test classic theme (default)**

1. Send another challenge with default settings (Classic, Off)
2. Verify: board renders with original olive/cream colors, no logo

- [ ] **Step 4: Test rematch carries over theme**

1. Complete a game (or resign)
2. Offer rematch → accept
3. Verify: new game uses same theme as the original

- [ ] **Step 5: Test all 10 themes render correctly**

For each theme, create a game and verify the board colors match the hex values in the spec. Pay special attention to:
- Midnight theme: dark squares are very dark (#2d2d2d), verify pieces are still visible
- Verus Dark: similar check
- Logo visibility on light themes (Emerald, Classic) vs dark themes (Midnight)
