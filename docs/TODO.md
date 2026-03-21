# Technical Debt & Future Work

## High Priority

### AuthContext Refactor
The app has no centralized auth state. User identity lives in `localStorage`, forcing workarounds everywhere:
- 9 window CustomEvents bridging components that can't communicate through React
- `window.__gameSocket` global instead of React-managed socket
- Every component independently reads `localStorage.getItem('currentUser')`
- SocketRegistration can't react to login (uses `usePathname()` hack to re-check)

**Fix:** Create an `AuthContext` provider in the root layout. Login sets user state, socket connects reactively, components use `useAuth()` hook. Eliminates most CustomEvents and the window global.

**Files affected:** `app/layout.tsx`, `app/login/page.tsx`, `components/dashboard/SocketRegistration.tsx`, `components/dashboard/ChallengeContext.tsx`, `app/users/page.tsx`, `app/game/[gameId]/GameClient.tsx`, `app/dashboard/page.tsx`

### Chess GameClient Encapsulation
`app/game/[gameId]/GameClient.tsx` is ~700 lines of chess-specific logic (piece hydration, promotion dialogs, checkmate detection). Non-chess games use a separate `GenericGameClient` branch at the top. Ideally, the chess Board component would fully encapsulate its own state so chess can use `GenericGameClient` too, and the 700-line chess code goes away.

**Fix:** Move chess state management (Board model hydration, promotion, move history tracking) into the chess `Board.tsx` component. Have it expose only `onMove(moveString, newBoardState)` like the checkers board does.

## Medium Priority

### Chess Sidebar Component
Chess MoveHistory + CapturedPiecesPanel are still loaded directly in GameClient, not through the `SidebarComponent` slot in GameConfig. The spec called for merging them into `app/games/chess/Sidebar.tsx`.

### Hardcoded Labels in UI
Some components still have chess-specific labels instead of using game config:
- `GameOver.tsx` — "Player 1:"/"Player 2:" (generic but not using config labels like "White"/"Red")
- `BlockchainInfoDialog.tsx` — generic text but could show actual parent identity name
- `app/users/page.tsx` — "Player 1"/"Player 2" in game history

### Browser Wallet Integration
Player signing is via CLI `verus signmessage`. No browser wallet integration yet.

### Auto-Store Unsigned Games
If neither player signs, the game stays local only. Could auto-store after a timeout.

## Low Priority

### SQLite-Specific Counter
`game-counter.ts` uses `INSERT OR IGNORE` which is SQLite-specific. Needs change for PostgreSQL.

### Original Mode Broken Import
`blockchain-move-storage-basic.js` has a broken import — original mode per-move storage will crash.

### Challenge Expiry
No timeout on pending challenges. Stale challenges accumulate.

### Sound/Browser Notifications
No audio or browser notification when a challenge arrives.

### 3D Chess Board
User expressed interest in a 3D board option as a separate future project.

### VDXF Key for Board Theme
Store the selected board theme on-chain alongside game data. Needs a new VDXF key per game type.
