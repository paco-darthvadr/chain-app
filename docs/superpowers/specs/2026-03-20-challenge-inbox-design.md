# Challenge Inbox — Design Spec

## Goal

Add a persistent challenge inbox to the navbar so players can receive, view, accept, decline, and cancel challenges from any page. Show real-time challenger status (online/busy/offline) and handle the "accept while busy" flow with a ping-pong ready system.

## Current Problem

Challenge notifications only appear on the users page (per-page socket listener). If a player is on any other page (e.g., blockchain submit screen), challenges are lost. The hamburger menu button in the navbar also incorrectly navigates to login instead of being a proper logout.

## Design

### Inbox UI

- Bell icon with badge count in the Navbar (beside the theme toggle)
- Clicking opens a dropdown panel (not a full page)
- Lists all pending challenges, each showing:
  - Challenger name, mode, board theme
  - Status dot: green (online/available), orange (in game), grey (offline)
  - Accept button (disabled if challenger is busy/offline), Decline button
  - Relative timestamp ("30s ago")
- Sent challenges show with a Cancel button
- "Accepted, waiting for opponent" state shows when you accepted a busy player's challenge
- "Player X accepted your challenge" with Start Game button (green when available, disabled when busy/offline)

### Challenge Lifecycle

```
Player 1 sends challenge
  → appears in Player 2's inbox (incoming)
  → appears in Player 1's inbox (sent, with Cancel)

Player 2 accepts (Player 1 available):
  → game created immediately, both routed to game
  → challenge removed from both inboxes

Player 2 accepts (Player 1 busy/in-game):
  → Player 2's inbox: "Accepted, waiting for Player 1"
  → Player 1's inbox: "Player 2 accepted your challenge" + Start Game button
  → Player 2 is NOT locked — can play other games, challenge others

Player 1 clicks Start Game (Player 2 available):
  → game created, both routed to game

Player 1 clicks Start Game (Player 2 now busy):
  → same flow reverses — Player 2 gets "Player 1 is ready" notification

Cancel:
  → either player can cancel at any time
  → removes from both inboxes

Decline:
  → removes from both inboxes
  → challenger gets notified
```

### Real-Time Status

- Server tracks user status: `available`, `in-game`, `offline`
- When a user joins a game room → status becomes `in-game`
- When a user finishes/leaves a game → status becomes `available`
- When a user disconnects → status becomes `offline`
- Status changes push to anyone with pending challenges involving that user
- Inbox dots update in real-time (green ↔ orange ↔ grey)

### State Management

- Challenge data stored in a React Context (`ChallengeContext`) so it persists across page navigations
- `SocketRegistration` component feeds challenge events into the context
- Users page stops creating its own socket — uses the global socket via context
- Inbox component reads from context

### Hamburger → Logout

- Change Menu icon to LogOut icon in Navbar
- Keep the same behavior (navigate to /login)

## Socket Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `challenge-user` | Client → Server | `{ challengerId, challengerName, challengeeId, mode, boardTheme, logoMode }` | Send challenge (existing, unchanged) |
| `new-challenge` | Server → Client | `{ challengerId, challengerName, mode, boardTheme, logoMode, challengerStatus }` | Relay challenge with status (enhanced) |
| `challenge-cancel` | Client → Server | `{ challengerId, challengeeId }` | Cancel a sent challenge |
| `challenge-cancelled` | Server → Client | `{ challengerId }` | Notify recipient of cancellation |
| `challenge-accepted-busy` | Client → Server | `{ challengerId, acceptorId, acceptorName }` | Accept while challenger is busy |
| `ready-to-play` | Server → Client | `{ acceptorId, acceptorName, mode, boardTheme, logoMode }` | Notify challenger that opponent accepted |
| `start-game` | Client → Server | `{ challengerId, challengeeId, mode, boardTheme, logoMode }` | Both ready, create game |
| `user-status-changed` | Server → Client | `{ userId, status }` | Push status updates to relevant clients |
| `challenge-declined` | existing | existing | Already exists |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `components/dashboard/ChallengeContext.tsx` | React context for challenge state |
| Create | `components/dashboard/ChallengeInbox.tsx` | Dropdown inbox component |
| Modify | `components/ui/Navbar.tsx` | Add inbox button, fix hamburger → logout |
| Modify | `components/dashboard/SocketRegistration.tsx` | Feed challenge events into context |
| Modify | `server.js` | Status tracking, new socket events |
| Modify | `app/users/page.tsx` | Remove local socket, use context for challenges |

## Out of Scope

- Challenge expiry timer (can add later)
- Sound/browser notifications
- Challenge history
