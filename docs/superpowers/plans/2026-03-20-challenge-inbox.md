# Challenge Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent challenge inbox to the navbar with real-time status tracking, accept-while-busy flow, and challenge cancellation.

**Architecture:** A React Context (`ChallengeContext`) stores all challenge state and persists across page navigations. `SocketRegistration` feeds socket events into the context. A dropdown `ChallengeInbox` component in the Navbar displays incoming/sent challenges with live status dots. The server tracks user status (available/in-game/offline) and pushes changes to relevant clients.

**Tech Stack:** Next.js 14, React Context, Socket.IO, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-20-challenge-inbox-design.md`

---

### Task 1: Server-side status tracking and new socket events

**Files:**
- Modify: `server.js`

This is the foundation — the server needs to track user game-status and handle new events before any client work.

- [ ] **Step 1: Add status tracking data structure**

After the existing `userSockets` declaration (line 40), add:

```js
const userGameStatus = {}; // { [userId]: 'available' | 'in-game' } — tracks game state
const pendingChallenges = []; // { challengerId, challengerName, challengeeId, mode, boardTheme, logoMode, timestamp }
```

- [ ] **Step 2: Add helper function to get user status**

After the data structures, add:

```js
function getUserStatus(userId) {
  if (!userSockets[userId] || userSockets[userId].size === 0) return 'offline';
  return userGameStatus[userId] || 'available';
}

function notifyStatusChange(userId) {
  const status = getUserStatus(userId);
  // Find all pending challenges involving this user and notify the other party
  pendingChallenges.forEach(c => {
    const notifyId = c.challengerId === userId ? c.challengeeId : c.challengerId;
    if (notifyId === userId) return;
    const notifySockets = userSockets[notifyId];
    if (notifySockets) {
      for (const sid of notifySockets) {
        io.to(sid).emit('user-status-changed', { userId, status });
      }
    }
  });
}
```

- [ ] **Step 3: Update joinGameRoom to track in-game status**

Update the existing `joinGameRoom` handler (around line 121):

Old:
```js
  socket.on('joinGameRoom', (gameId) => {
    socket.join(gameId);
    console.log(`User ${socket.id} joined game room ${gameId}`);
  });
```

New:
```js
  socket.on('joinGameRoom', (gameId) => {
    socket.join(gameId);
    if (socket.userId) {
      userGameStatus[socket.userId] = 'in-game';
      notifyStatusChange(socket.userId);
    }
    console.log(`User ${socket.id} joined game room ${gameId}`);
  });
```

- [ ] **Step 4: Add leave-game status update**

Update the existing `leave-game` handler (around line 152) to also reset status:

Old:
```js
  socket.on('leave-game', ({ gameId }) => {
    if (socket.userId) {
        console.log(`User ${socket.userId} left game ${gameId}`);
        // Notify the other player in the room
        socket.to(gameId).emit('opponent-left', { leaverId: socket.userId });
    }
  });
```

New:
```js
  socket.on('leave-game', ({ gameId }) => {
    if (socket.userId) {
        console.log(`User ${socket.userId} left game ${gameId}`);
        socket.to(gameId).emit('opponent-left', { leaverId: socket.userId });
        userGameStatus[socket.userId] = 'available';
        notifyStatusChange(socket.userId);
    }
  });
```

- [ ] **Step 5: Update challenge-user handler to store pending challenge and include status**

Update the challenge-user handler (around line 77). The current handler destructures `{ challengerId, challengerName, challengeeId, mode, boardTheme, logoMode }`. Update the emit to include `challengerStatus` and store the challenge:

After the existing `console.log` lines and before the `if (challengeeSockets)` check, add:

```js
    // Store pending challenge
    pendingChallenges.push({
      challengerId, challengerName, challengeeId, mode,
      boardTheme: boardTheme || 'classic', logoMode: logoMode || 'off',
      timestamp: Date.now()
    });
```

In the `new-challenge` emit, add `challengerStatus`:

```js
            io.to(sid).emit('new-challenge', {
                challengerId: challengerId,
                challengerName: challengerName,
                mode: mode,
                boardTheme: boardTheme || 'classic',
                logoMode: logoMode || 'off',
                challengerStatus: getUserStatus(challengerId)
            });
```

- [ ] **Step 6: Add challenge-cancel handler**

After the `challenge-declined` handler (around line 113), add:

```js
  socket.on('challenge-cancel', ({ challengerId, challengeeId }) => {
    // Remove from pending
    const idx = pendingChallenges.findIndex(c => c.challengerId === challengerId && c.challengeeId === challengeeId);
    if (idx !== -1) pendingChallenges.splice(idx, 1);

    // Notify the other party
    const targetSockets = userSockets[challengeeId];
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit('challenge-cancelled', { challengerId });
      }
    }
    console.log(`Challenge from ${challengerId} to ${challengeeId} cancelled`);
  });
```

- [ ] **Step 7: Add challenge-accepted-busy handler**

After the challenge-cancel handler, add:

```js
  socket.on('challenge-accepted-busy', ({ challengerId, acceptorId, acceptorName, mode, boardTheme, logoMode }) => {
    // Notify the challenger that the acceptor is ready
    const challengerSockets = userSockets[challengerId];
    if (challengerSockets) {
      for (const sid of challengerSockets) {
        io.to(sid).emit('ready-to-play', {
          acceptorId, acceptorName, mode,
          boardTheme: boardTheme || 'classic',
          logoMode: logoMode || 'off',
          acceptorStatus: getUserStatus(acceptorId)
        });
      }
    }
    console.log(`${acceptorName} accepted busy challenge from ${challengerId}`);
  });
```

- [ ] **Step 8: Add start-game handler**

After the challenge-accepted-busy handler, add:

```js
  socket.on('start-game', async ({ challengerId, challengeeId, mode, boardTheme, logoMode }) => {
    // Both players ready — create the game
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const internalHeaders = { 'Content-Type': 'application/json' };
      if (process.env.INTERNAL_API_SECRET) internalHeaders['x-internal-api-secret'] = process.env.INTERNAL_API_SECRET;

      const [white, black] = Math.random() < 0.5
        ? [challengerId, challengeeId]
        : [challengeeId, challengerId];

      const createResponse = await fetch(`${appUrl}/api/game`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          whitePlayerId: white, blackPlayerId: black,
          mode: mode || 'normal',
          boardTheme: boardTheme || 'classic',
          logoMode: logoMode || 'off',
        }),
      });

      if (!createResponse.ok) throw new Error('Failed to create game');
      const newGame = await createResponse.json();

      // Remove from pending challenges
      const idx = pendingChallenges.findIndex(c =>
        (c.challengerId === challengerId && c.challengeeId === challengeeId) ||
        (c.challengerId === challengeeId && c.challengeeId === challengerId)
      );
      if (idx !== -1) pendingChallenges.splice(idx, 1);

      // Notify both players
      [challengerId, challengeeId].forEach(userId => {
        const sockets = userSockets[userId];
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('game-started', { gameId: newGame.id });
          }
        }
      });

      console.log(`Game ${newGame.id} created from start-game (${challengerId} vs ${challengeeId})`);
    } catch (error) {
      console.error('Error creating game from start-game:', error);
      socket.emit('challenge-failed', { message: 'Could not create the game. Please try again.' });
    }
  });
```

- [ ] **Step 9: Update disconnect handler to clean up and notify status change**

Update the disconnect handler (around line 237). After the existing `userSockets` cleanup block, add pending challenge cleanup and status notification. The key part is after `delete userSockets[socket.userId]` (which means user is fully offline):

Add before the final `console.log('A user disconnected')`:

```js
    // Notify status change for pending challenges
    if (socket.userId) {
      notifyStatusChange(socket.userId);
      // Clean up game status
      if (userSockets[socket.userId] === undefined) {
        delete userGameStatus[socket.userId];
      }
    }
```

- [ ] **Step 10: Update challenge-declined to clean up pending challenges**

Update the existing `challenge-declined` handler. Add cleanup before the socket emit:

```js
  socket.on('challenge-declined', ({ challengerId, declinerName }) => {
      // Remove from pending
      const idx = pendingChallenges.findIndex(c => c.challengerId === challengerId && c.challengeeId === socket.userId);
      if (idx !== -1) pendingChallenges.splice(idx, 1);

      const challengerSockets = userSockets[challengerId];
      if (challengerSockets) {
          for (const sid of challengerSockets) {
              io.to(sid).emit('challenge-denied', { challengerId, declinerName });
          }
      }
  });
```

- [ ] **Step 11: Remove old challenge-accepted handler (dead code)**

The old `challenge-accepted` handler (around line 97-104) is no longer used — game creation now goes through `start-game`. Remove it:

```js
  // DELETE this entire block:
  socket.on('challenge-accepted', ({ challengerId, gameId }) => {
      const challengerSockets = userSockets[challengerId];
      if (challengerSockets) {
          for (const sid of challengerSockets) {
              io.to(sid).emit('game-started', { gameId });
          }
      }
  });
```

- [ ] **Step 12: Commit**

```bash
git add server.js
git commit -m "feat: add server-side status tracking, challenge lifecycle events, and start-game handler"
```

---

### Task 2: Challenge Context

**Files:**
- Create: `components/dashboard/ChallengeContext.tsx`

A React Context that stores challenge state across page navigations.

- [ ] **Step 1: Create the ChallengeContext**

```tsx
// components/dashboard/ChallengeContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Challenge {
  challengerId: string;
  challengerName: string;
  challengeeId?: string;
  mode: string;
  boardTheme: string;
  logoMode: string;
  challengerStatus: 'available' | 'in-game' | 'offline';
  timestamp: number;
  // For the ping-pong ready flow
  state: 'incoming' | 'sent' | 'accepted-waiting' | 'opponent-ready';
  acceptorName?: string; // set when opponent accepts our sent challenge
}

interface ChallengeContextType {
  challenges: Challenge[];
  addChallenge: (challenge: Challenge) => void;
  removeChallenge: (challengerId: string) => void;
  updateChallengerStatus: (userId: string, status: 'available' | 'in-game' | 'offline') => void;
  markAcceptedWaiting: (challengerId: string) => void;
  markOpponentReady: (challengerId: string, acceptorName: string) => void;
  clearAll: () => void;
}

const ChallengeContext = createContext<ChallengeContextType | null>(null);

export function useChallenges() {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw new Error('useChallenges must be inside ChallengeProvider');
  return ctx;
}

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const addChallenge = useCallback((challenge: Challenge) => {
    setChallenges(prev => {
      // Don't add duplicates
      if (prev.some(c => c.challengerId === challenge.challengerId && c.state === challenge.state)) {
        return prev;
      }
      return [...prev, challenge];
    });
  }, []);

  const removeChallenge = useCallback((challengerId: string) => {
    setChallenges(prev => prev.filter(c => c.challengerId !== challengerId));
  }, []);

  const updateChallengerStatus = useCallback((userId: string, status: 'available' | 'in-game' | 'offline') => {
    setChallenges(prev => prev.map(c => {
      if (c.challengerId === userId) return { ...c, challengerStatus: status };
      // Also update if this userId is the challengee on a sent challenge
      if (c.challengeeId === userId) return { ...c, challengerStatus: status };
      return c;
    }));
  }, []);

  const markAcceptedWaiting = useCallback((challengerId: string) => {
    setChallenges(prev => prev.map(c =>
      c.challengerId === challengerId && c.state === 'incoming'
        ? { ...c, state: 'accepted-waiting' as const }
        : c
    ));
  }, []);

  const markOpponentReady = useCallback((challengerId: string, acceptorName: string) => {
    setChallenges(prev => prev.map(c =>
      c.challengerId === challengerId || c.challengeeId === challengerId
        ? { ...c, state: 'opponent-ready' as const, acceptorName }
        : c
    ));
  }, []);

  const clearAll = useCallback(() => setChallenges([]), []);

  return (
    <ChallengeContext.Provider value={{
      challenges, addChallenge, removeChallenge,
      updateChallengerStatus, markAcceptedWaiting, markOpponentReady, clearAll
    }}>
      {children}
    </ChallengeContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/ChallengeContext.tsx
git commit -m "feat: add ChallengeContext for persistent challenge state across pages"
```

---

### Task 3: Wire SocketRegistration into ChallengeContext

**Files:**
- Modify: `components/dashboard/SocketRegistration.tsx`
- Modify: `components/dashboard/DashboardLayout.tsx`

- [ ] **Step 1: Wrap DashboardLayout children with ChallengeProvider**

In `components/dashboard/DashboardLayout.tsx`, add the import and wrapper:

Add import:
```tsx
import { ChallengeProvider } from "@/components/dashboard/ChallengeContext";
```

Wrap the content with `<ChallengeProvider>`:
```tsx
export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <ChallengeProvider>
            <SocketRegistration />
            <SideNav />
            <main className="flex-1 flex flex-col">
                <Navbar />
                <div className="p-8 flex-1">{children}</div>
            </main>
        </ChallengeProvider>
    );
}
```

- [ ] **Step 2: Update SocketRegistration to feed events into ChallengeContext**

Rewrite `components/dashboard/SocketRegistration.tsx`. The key changes:
- Import and use `useChallenges` hook
- On `new-challenge`: add to context as incoming challenge
- On `challenge-cancelled`: remove from context
- On `challenge-denied`: remove from context
- On `user-status-changed`: update status in context
- On `ready-to-play`: mark opponent-ready in context
- On `game-started`: clear challenge and redirect
- Keep existing CustomEvent dispatches for backward compat with users page refresh events

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChallenges } from './ChallengeContext';

export function getGlobalSocket(): Socket | null {
    if (typeof window !== 'undefined') {
        return (window as any).__chessSocket || null;
    }
    return null;
}

function setGlobalSocket(socket: Socket | null) {
    if (typeof window !== 'undefined') {
        (window as any).__chessSocket = socket;
    }
}

export default function SocketRegistration() {
    const initialized = useRef(false);
    const { addChallenge, removeChallenge, updateChallengerStatus, markOpponentReady } = useChallenges();

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const userId = localStorage.getItem('currentUser');
        if (!userId) return;

        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
        const socket = io(socketURL);
        setGlobalSocket(socket);

        socket.on('connect', () => {
            socket.emit('register-user', userId);
            console.log('[SocketRegistration] Registered user', userId);
        });

        socket.on('new-challenge', ({ challengerId, challengerName, mode, boardTheme, logoMode, challengerStatus }) => {
            addChallenge({
                challengerId,
                challengerName,
                mode: mode || 'normal',
                boardTheme: boardTheme || 'classic',
                logoMode: logoMode || 'off',
                challengerStatus: challengerStatus || 'available',
                timestamp: Date.now(),
                state: 'incoming',
            });
            window.dispatchEvent(new CustomEvent('socket:new-challenge', {
                detail: { challengerId, challengerName, mode }
            }));
        });

        socket.on('challenge-cancelled', ({ challengerId }) => {
            removeChallenge(challengerId);
        });

        socket.on('challenge-failed', ({ message }) => {
            window.dispatchEvent(new CustomEvent('socket:challenge-failed', {
                detail: { message }
            }));
        });

        socket.on('game-started', ({ gameId }) => {
            window.dispatchEvent(new CustomEvent('socket:game-started', {
                detail: { gameId }
            }));
            window.location.href = `/game/${gameId}`;
        });

        socket.on('challenge-denied', ({ challengerId, declinerName }) => {
            // Remove the declined sent challenge by challengerId
            if (challengerId) removeChallenge(challengerId);
            window.dispatchEvent(new CustomEvent('socket:challenge-denied', {
                detail: { declinerName }
            }));
        });

        socket.on('user-status-changed', ({ userId: changedUserId, status }) => {
            updateChallengerStatus(changedUserId, status);
        });

        socket.on('ready-to-play', ({ acceptorId, acceptorName, mode, boardTheme, logoMode, acceptorStatus }) => {
            markOpponentReady(acceptorId, acceptorName);
        });

        socket.on('refresh-game-list', () => {
            window.dispatchEvent(new CustomEvent('socket:refresh-game-list'));
        });

        socket.on('refresh-user-list', () => {
            window.dispatchEvent(new CustomEvent('socket:refresh-user-list'));
        });

        return () => {
            socket.disconnect();
            setGlobalSocket(null);
        };
    }, [addChallenge, removeChallenge, updateChallengerStatus, markOpponentReady]);

    return null;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/SocketRegistration.tsx components/dashboard/DashboardLayout.tsx
git commit -m "feat: wire SocketRegistration into ChallengeContext, wrap layout with ChallengeProvider"
```

---

### Task 4: ChallengeInbox dropdown component

**Files:**
- Create: `components/dashboard/ChallengeInbox.tsx`

- [ ] **Step 1: Create the ChallengeInbox component**

```tsx
// components/dashboard/ChallengeInbox.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChallenges, Challenge } from './ChallengeContext';
import { getGlobalSocket } from './SocketRegistration';
import { getTheme } from '@/app/utils/board-themes';

function StatusDot({ status }: { status: string }) {
  const color = status === 'available' ? 'bg-green-500'
    : status === 'in-game' ? 'bg-orange-500'
    : 'bg-gray-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function ChallengeItem({ challenge, currentUserId }: { challenge: Challenge; currentUserId: string }) {
  const { removeChallenge, markAcceptedWaiting } = useChallenges();
  const socket = getGlobalSocket();

  const handleAccept = () => {
    if (!socket) return;
    const status = challenge.challengerStatus;

    if (status === 'available') {
      // Challenger is available — create game immediately via existing accept flow
      socket.emit('start-game', {
        challengerId: challenge.challengerId,
        challengeeId: currentUserId,
        mode: challenge.mode,
        boardTheme: challenge.boardTheme,
        logoMode: challenge.logoMode,
      });
      removeChallenge(challenge.challengerId);
    } else {
      // Challenger is busy — send ready notification
      socket.emit('challenge-accepted-busy', {
        challengerId: challenge.challengerId,
        acceptorId: currentUserId,
        acceptorName: localStorage.getItem('currentUserName') || currentUserId,
        mode: challenge.mode,
        boardTheme: challenge.boardTheme,
        logoMode: challenge.logoMode,
      });
      markAcceptedWaiting(challenge.challengerId);
    }
  };

  const handleDecline = () => {
    if (!socket) return;
    const currentUserName = localStorage.getItem('currentUserName') || currentUserId;
    socket.emit('challenge-declined', {
      challengerId: challenge.challengerId,
      declinerName: currentUserName,
    });
    removeChallenge(challenge.challengerId);
  };

  const handleCancel = () => {
    if (!socket) return;
    socket.emit('challenge-cancel', {
      challengerId: currentUserId,
      challengeeId: challenge.challengeeId,
    });
    removeChallenge(challenge.challengerId);
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('start-game', {
      challengerId: currentUserId,
      challengeeId: challenge.challengeeId,
      mode: challenge.mode,
      boardTheme: challenge.boardTheme,
      logoMode: challenge.logoMode,
    });
    removeChallenge(challenge.challengerId);
  };

  if (challenge.state === 'incoming') {
    const themeName = getTheme(challenge.boardTheme).name;
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusDot status={challenge.challengerStatus} />
            <span className="font-medium text-sm">{challenge.challengerName}</span>
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo(challenge.timestamp)}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {challenge.mode === 'showcase' ? 'Showcase' : 'Normal'}
          {challenge.boardTheme !== 'classic' && ` · ${themeName}`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleAccept}
            disabled={challenge.challengerStatus === 'offline'}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline}>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  if (challenge.state === 'sent') {
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm">Sent to <span className="font-medium">{challenge.challengerName}</span></span>
          <span className="text-xs text-muted-foreground">{timeAgo(challenge.timestamp)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (challenge.state === 'accepted-waiting') {
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusDot status={challenge.challengerStatus} />
            <span className="font-medium text-sm">{challenge.challengerName}</span>
          </div>
        </div>
        <p className="text-xs text-amber-400">Accepted — waiting for {challenge.challengerName}</p>
      </div>
    );
  }

  if (challenge.state === 'opponent-ready') {
    return (
      <div className="p-3 border-b last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusDot status={challenge.challengerStatus} />
            <span className="font-medium text-sm">{challenge.acceptorName || 'Opponent'}</span>
          </div>
        </div>
        <p className="text-xs text-green-400 mb-2">Ready to play!</p>
        <Button size="sm" variant="default" onClick={handleStartGame}
          disabled={challenge.challengerStatus !== 'available'}>
          Start Game
        </Button>
      </div>
    );
  }

  return null;
}

export default function ChallengeInbox() {
  const [open, setOpen] = useState(false);
  const { challenges } = useChallenges();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const count = challenges.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="relative">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Challenges</h3>
          </div>
          {challenges.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No pending challenges
            </div>
          ) : (
            challenges.map((c, i) => (
              <ChallengeItem key={`${c.challengerId}-${c.state}-${i}`} challenge={c} currentUserId={currentUserId || ''} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/ChallengeInbox.tsx
git commit -m "feat: add ChallengeInbox dropdown with status dots, accept/decline/cancel/start-game"
```

---

### Task 5: Update Navbar with inbox and fix logout button

**Files:**
- Modify: `components/ui/Navbar.tsx`

- [ ] **Step 1: Update Navbar imports and add ChallengeInbox + fix logout icon**

Replace the entire `Navbar.tsx` content:

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SidebarItems } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ThemeSwitcher } from "./ThemeSwitcher";
import ChallengeInbox from '@/components/dashboard/ChallengeInbox';

const Navbar = () => {
    const pathname = usePathname();
    const router = useRouter();

    const getPageTitle = () => {
        const item = SidebarItems.find(item => item.href === pathname);
        return item ? item.label : '';
    };

    return (
        <header className="flex items-center justify-between p-4 bg-background border-b border-border">
            <h1 className="text-xl font-bold">{getPageTitle()}</h1>
            <div className="flex items-center space-x-2">
                <ChallengeInbox />
                <ThemeSwitcher />
                <Button variant="ghost" size="icon" onClick={() => router.push('/login')}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
        </header>
    );
};

export default Navbar;
```

Changes: `Menu` → `LogOut` icon, added `ChallengeInbox` between title and theme switcher.

- [ ] **Step 2: Commit**

```bash
git add components/ui/Navbar.tsx
git commit -m "feat: add ChallengeInbox to Navbar, change hamburger menu to LogOut icon"
```

---

### Task 6: Update users page to use context and add sent challenges

**Files:**
- Modify: `app/users/page.tsx`

The users page currently creates its own socket and handles challenges locally. We need to:
1. Remove the local socket's challenge handling (context handles it now)
2. Add sent challenges to context when user sends a challenge
3. Remove the inline incoming challenge popup (inbox handles it now)

- [ ] **Step 1: Add context import and hook**

Add import at top:
```tsx
import { useChallenges } from '@/components/dashboard/ChallengeContext';
```

Inside the `UsersPage` function, after the existing state declarations, add:
```tsx
const { addChallenge, removeChallenge } = useChallenges();
```

- [ ] **Step 2: Remove the incomingChallenge state and its popup**

Remove:
```tsx
const [incomingChallenge, setIncomingChallenge] = useState<{ challengerId: string, challengerName: string, mode?: string, boardTheme?: string, logoMode?: string } | null>(null);
```

Remove the entire `{incomingChallenge && (...)}` block from the JSX (the fixed overlay popup with Accept/Decline buttons).

Remove `handleAcceptChallenge` and `handleDeclineChallenge` functions.

Remove the `new-challenge` socket listener from the useEffect.

- [ ] **Step 3: Update handleConfirmChallenge to also add to context as a sent challenge**

After the existing `socket.emit('challenge-user', ...)` call in `handleConfirmChallenge`, add:

```tsx
    // Track in inbox as sent challenge
    const targetName = challengeTarget.displayName || challengeTarget.verusId;
    addChallenge({
      challengerId: currentUserId,
      challengerName: targetName, // Display name of who we're challenging
      challengeeId: challengeTarget.id,
      mode,
      boardTheme,
      logoMode,
      challengerStatus: 'available',
      timestamp: Date.now(),
      state: 'sent',
    });
```

- [ ] **Step 4: Store currentUserName in localStorage for the inbox**

In the `fetchUsersAndGames` callback, after `localStorage.setItem('currentUser', newCurrentId)`, add:

```tsx
                const currentUser = fetchedUsers.find((u: User) => u.id === newCurrentId);
                if (currentUser) {
                    localStorage.setItem('currentUserName', currentUser.displayName || currentUser.verusId);
                }
```

Note: Check if there's already a `currentUser` lookup near this line to avoid duplicating. The `currentUser` variable may already be defined — if so, just add the `localStorage.setItem` line.

- [ ] **Step 5: Clean up - remove the socket listeners that context now handles**

In the useEffect socket setup, remove these listeners (context handles them now via SocketRegistration):
- `socket.on('new-challenge', ...)` — already handled by context
- `socket.on('challenge-denied', ...)` — already handled by context

Keep these listeners (they handle page-specific refreshing):
- `socket.on('challenge-failed', ...)` — clears the `challengeSent` state
- `socket.on('game-started', ...)` — router push
- `socket.on('refresh-game-list', ...)`
- `socket.on('refresh-user-list', ...)`

- [ ] **Step 6: Remove !!incomingChallenge from Challenge button disabled check**

The Challenge button has `disabled={... || !!incomingChallenge}`. Since `incomingChallenge` state is removed, remove that condition.

- [ ] **Step 7: Commit**

```bash
git add app/users/page.tsx
git commit -m "feat: users page uses ChallengeContext, removes local challenge handling"
```

---

### Task 7: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Start servers**

```bash
# Kill any existing processes on 3002
# Terminal 1: node server.js
# Terminal 2: npx next dev -p 3000
```

- [ ] **Step 2: Test basic challenge flow**

1. Open two browsers, log in as different users
2. Player 1 clicks Challenge → ChallengeModal opens → Send Challenge
3. Verify: Bell icon on Player 2's navbar shows badge "1"
4. Player 2 clicks bell → dropdown shows incoming challenge with green status dot
5. Player 2 clicks Accept → game creates, both redirected

- [ ] **Step 3: Test accept-while-busy flow**

1. Player 1 starts a game with someone (or is on a game page)
2. Player 2 sends challenge to Player 1
3. Player 2's inbox shows Player 1 with orange dot (in-game)
4. Player 2 clicks Accept → inbox shows "Accepted — waiting for Player 1"
5. Player 1's inbox shows "Player 2 accepted your challenge" with Start Game button
6. Player 1 finishes game, clicks Start Game → new game created

- [ ] **Step 4: Test cancel flow**

1. Player 1 sends challenge → appears as "sent" in Player 1's inbox
2. Player 1 clicks Cancel → removed from both inboxes
3. Verify Player 2's badge count decrements

- [ ] **Step 5: Test logout button**

1. Verify the 3-line menu is now a LogOut icon
2. Click it → navigates to /login

- [ ] **Step 6: Test status updates**

1. Player 2 sends challenge to Player 1
2. Player 1 navigates to a game → status dot should turn orange
3. Player 1 leaves game → status dot should turn green
4. Player 1 closes tab → status dot should turn grey
