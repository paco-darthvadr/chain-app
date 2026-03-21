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

### GenericGameClient — Showcase Signing + Rematch (Blocks multi-game scaling)
`GenericGameClient` has no showcase signing flow — `ShowcaseSigningPrompt` is not rendered, `move-signed` socket event is not handled. Any non-chess game in showcase mode silently has no signing. Rematch handler is a stub (`// TODO`). Also, chess imports at the top of `GameClient.tsx` are loaded for ALL games.

**Fix:** Port the chess client's signing state machine into GenericGameClient. Implement rematch UI. Long-term: encapsulate chess so it uses GenericGameClient too (see Chess GameClient Encapsulation above).

### Data-Driven Sidebar Nav (Blocks multi-game scaling)
`lib/constants.ts` has hardcoded per-game links. Every new game requires a manual edit. With 10 games this explodes.

**Fix:** Generate sidebar items from `getAllGameTypes()` — loop over registered games and create links dynamically. Remove hardcoded chess/checkers entries.

### Remove Chess Env Var Fallbacks (Blocks multi-game scaling)
`subid-pool.ts` and `subid-storage.ts` silently fall back to `process.env.CHESSGAME_IDENTITY_ADDRESS` if a game's config doesn't pass its address. A new game with missing env vars would silently register SubIDs under `ChessGame@`.

**Fix:** Remove the `CHESSGAME_*` fallbacks. Add startup validation that warns if `chainEnabled: true` but identity address/WIF is empty.

### Board Theme Custom Mode
`themeMode: 'custom'` exists in the GameConfig interface but is dead code — nothing reads it. Non-grid games (mancala, card games) get a meaningless 8x8 theme picker. MiniBoard preview in ChallengeModal is always 8x8.

**Fix:** Either wire up `'custom'` (gate theme picker per game, pass custom theme config) or remove it and let non-grid games ignore the theme prop.

### GameOver Chess-isms
- `currentPlayer: 'white' | 'black'` type in GameOverProps — should be `1 | 2`
- Checkers-specific move count branch (`capturedRed`/`capturedBlack`) — add `getMoveCount()` to GameConfig instead
- Move count `?` for non-chess games — fixed with `_count.moves` but could be cleaner

### Env Var Sprawl
3 env vars per game type (NAME, ADDRESS, WIF). At 10 games = 30 env vars. No startup validation. Naming convention is by convention only, not enforced.

**Fix:** Consider a single JSON config file or env var prefix convention with auto-discovery. Add startup check.

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
