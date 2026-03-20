import { CheckerPiece, clonePiece } from './models/CheckerPiece';
import { PieceType, Team } from './types';
import { BOARD_SIZE } from './constants';

export interface CheckersState {
  pieces: CheckerPiece[];
  currentTeam: Team;
  capturedRed: number;
  capturedBlack: number;
}

export interface MoveTarget {
  row: number;
  col: number;
  jumpedPiece?: CheckerPiece; // piece captured by this jump
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function pieceAt(pieces: CheckerPiece[], row: number, col: number): CheckerPiece | undefined {
  return pieces.find(p => p.row === row && p.col === col);
}

function forwardDirections(team: Team): number[] {
  // Red (player 1) moves toward higher rows; Black (player 2) toward lower rows
  return team === Team.RED ? [1] : [-1];
}

function moveDirections(piece: CheckerPiece): number[] {
  if (piece.type === PieceType.KING) return [1, -1];
  return forwardDirections(piece.team);
}

// ---------------------------------------------------------------------------
// Move / jump computation
// ---------------------------------------------------------------------------

/**
 * Return simple (non-jump) moves for a piece.
 */
export function getSimpleMoves(piece: CheckerPiece, pieces: CheckerPiece[]): MoveTarget[] {
  const targets: MoveTarget[] = [];
  const rowDirs = moveDirections(piece);

  for (const dr of rowDirs) {
    for (const dc of [-1, 1]) {
      const nr = piece.row + dr;
      const nc = piece.col + dc;
      if (inBounds(nr, nc) && !pieceAt(pieces, nr, nc)) {
        targets.push({ row: nr, col: nc });
      }
    }
  }
  return targets;
}

/**
 * Return jump moves for a piece (single hop only — multi-jump handled separately).
 */
export function getJumpMoves(piece: CheckerPiece, pieces: CheckerPiece[]): MoveTarget[] {
  const targets: MoveTarget[] = [];
  const rowDirs = moveDirections(piece);

  for (const dr of rowDirs) {
    for (const dc of [-1, 1]) {
      const midR = piece.row + dr;
      const midC = piece.col + dc;
      const landR = piece.row + dr * 2;
      const landC = piece.col + dc * 2;

      if (!inBounds(landR, landC)) continue;

      const midPiece = pieceAt(pieces, midR, midC);
      if (midPiece && midPiece.team !== piece.team && !pieceAt(pieces, landR, landC)) {
        targets.push({ row: landR, col: landC, jumpedPiece: midPiece });
      }
    }
  }
  return targets;
}

/**
 * Does any piece on `team` have a jump available?
 */
export function teamHasJump(pieces: CheckerPiece[], team: Team): boolean {
  return pieces.filter(p => p.team === team).some(p => getJumpMoves(p, pieces).length > 0);
}

/**
 * Get all valid move targets for a piece, respecting forced-jump rule.
 */
export function getValidMoves(piece: CheckerPiece, pieces: CheckerPiece[]): MoveTarget[] {
  const hasTeamJump = teamHasJump(pieces, piece.team);

  if (hasTeamJump) {
    // Must jump — only return jump moves for this piece
    return getJumpMoves(piece, pieces);
  }

  return getSimpleMoves(piece, pieces);
}

/**
 * After landing from a jump, check if further jumps are available from the
 * landing position (multi-jump chain). Returns jump targets from the new position.
 */
export function getContinuationJumps(piece: CheckerPiece, pieces: CheckerPiece[]): MoveTarget[] {
  return getJumpMoves(piece, pieces);
}

// ---------------------------------------------------------------------------
// Apply move
// ---------------------------------------------------------------------------

/**
 * Check if a piece should be kinged at its current position.
 */
function shouldKing(piece: CheckerPiece): boolean {
  if (piece.type === PieceType.KING) return false;
  if (piece.team === Team.RED && piece.row === BOARD_SIZE - 1) return true;
  if (piece.team === Team.BLACK && piece.row === 0) return true;
  return false;
}

/**
 * Parse a move string like "2,1-4,3" or "2,1-4,3-6,5" into an array of
 * {row, col} steps.
 */
export function parseMoveString(move: string): { row: number; col: number }[] {
  return move.split('-').map(part => {
    const [r, c] = part.split(',').map(Number);
    return { row: r, col: c };
  });
}

/**
 * Build a move string from an array of {row, col} steps.
 */
export function buildMoveString(steps: { row: number; col: number }[]): string {
  return steps.map(s => `${s.row},${s.col}`).join('-');
}

/**
 * Apply a full move (possibly multi-jump) to the state, returning a new state.
 * Does NOT validate — caller should validate first.
 */
export function applyMoveToState(state: CheckersState, move: string, _player: 1 | 2): CheckersState {
  const steps = parseMoveString(move);
  if (steps.length < 2) return state;

  let pieces = state.pieces.map(clonePiece);
  let capturedRed = state.capturedRed;
  let capturedBlack = state.capturedBlack;

  const startPos = steps[0];
  const pieceIdx = pieces.findIndex(p => p.row === startPos.row && p.col === startPos.col);
  if (pieceIdx === -1) return state;

  const movingPiece = pieces[pieceIdx];

  for (let i = 1; i < steps.length; i++) {
    const from = steps[i - 1];
    const to = steps[i];
    const dr = to.row - from.row;
    const dc = to.col - from.col;

    // Is this a jump? (distance of 2)
    if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
      const midR = from.row + dr / 2;
      const midC = from.col + dc / 2;
      const capturedIdx = pieces.findIndex(p => p.row === midR && p.col === midC);
      if (capturedIdx !== -1) {
        const capturedPiece = pieces[capturedIdx];
        if (capturedPiece.team === Team.RED) capturedRed++;
        else capturedBlack++;
        pieces.splice(capturedIdx, 1);
        // Adjust movingPiece index if it shifted
        const newPieceIdx = pieces.findIndex(p => p === movingPiece);
        if (newPieceIdx === -1) return state; // shouldn't happen
      }
    }

    // Move piece to new position
    movingPiece.row = to.row;
    movingPiece.col = to.col;
  }

  // Kinging
  if (shouldKing(movingPiece)) {
    movingPiece.type = PieceType.KING;
  }

  const nextTeam = state.currentTeam === Team.RED ? Team.BLACK : Team.RED;

  return {
    pieces,
    currentTeam: nextTeam,
    capturedRed,
    capturedBlack,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate whether a move string is legal in the given state for the given player.
 */
export function validateMove(state: CheckersState, move: string, player: 1 | 2): boolean {
  const expectedTeam = player === 1 ? Team.RED : Team.BLACK;
  if (state.currentTeam !== expectedTeam) return false;

  const steps = parseMoveString(move);
  if (steps.length < 2) return false;

  const startPos = steps[0];
  const piece = state.pieces.find(p => p.row === startPos.row && p.col === startPos.col);
  if (!piece || piece.team !== expectedTeam) return false;

  // Simulate step by step
  let pieces = state.pieces.map(clonePiece);
  let simPiece = pieces.find(p => p.row === startPos.row && p.col === startPos.col)!;

  const hasTeamJump = teamHasJump(pieces, expectedTeam);

  for (let i = 1; i < steps.length; i++) {
    const to = steps[i];
    const dr = to.row - simPiece.row;
    const dc = to.col - simPiece.col;

    if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
      // Simple move — only valid as the only step, and only if no jump is forced
      if (steps.length !== 2) return false;
      if (hasTeamJump) return false;

      const simMoves = getSimpleMoves(simPiece, pieces);
      if (!simMoves.some(m => m.row === to.row && m.col === to.col)) return false;
    } else if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
      // Jump
      const jumpMoves = getJumpMoves(simPiece, pieces);
      const target = jumpMoves.find(m => m.row === to.row && m.col === to.col);
      if (!target) return false;

      // Remove captured piece
      const midR = simPiece.row + dr / 2;
      const midC = simPiece.col + dc / 2;
      const capIdx = pieces.findIndex(p => p.row === midR && p.col === midC);
      if (capIdx !== -1) pieces.splice(capIdx, 1);

      // Move piece
      simPiece.row = to.row;
      simPiece.col = to.col;

      // If there are more steps, a continuation jump must be available
      if (i < steps.length - 1) {
        // Check if piece gets kinged mid-chain — in standard checkers,
        // if you reach the king row during a multi-jump, the turn ends there.
        if (shouldKing(simPiece)) return false; // can't continue after kinging

        const contJumps = getContinuationJumps(simPiece, pieces);
        if (contJumps.length === 0) return false;
      }
    } else {
      return false; // invalid distance
    }
  }

  // After the last step of a jump sequence, if further jumps are available and
  // the piece didn't get kinged, the player must continue — the move is incomplete.
  if (steps.length > 2 || (steps.length === 2 && Math.abs(steps[1].row - steps[0].row) === 2)) {
    // It was a jump move — check if there are continuation jumps the player missed
    if (!shouldKing(simPiece)) {
      const contJumps = getContinuationJumps(simPiece, pieces);
      if (contJumps.length > 0) return false; // must keep jumping
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Game status
// ---------------------------------------------------------------------------

/**
 * Check if a team has any valid moves (simple or jump).
 */
export function teamHasAnyMoves(pieces: CheckerPiece[], team: Team): boolean {
  const teamPieces = pieces.filter(p => p.team === team);
  return teamPieces.some(p => {
    return getSimpleMoves(p, pieces).length > 0 || getJumpMoves(p, pieces).length > 0;
  });
}

export interface GameStatusResult {
  isOver: boolean;
  winner: 1 | 2 | null;
  result: string;
  resultDisplay: string;
}

/**
 * Determine game status from the current state.
 */
export function getGameStatus(state: CheckersState): GameStatusResult {
  const redPieces = state.pieces.filter(p => p.team === Team.RED);
  const blackPieces = state.pieces.filter(p => p.team === Team.BLACK);

  // No pieces left
  if (redPieces.length === 0) {
    return { isOver: true, winner: 2, result: 'elimination', resultDisplay: 'Black wins — all red pieces captured!' };
  }
  if (blackPieces.length === 0) {
    return { isOver: true, winner: 1, result: 'elimination', resultDisplay: 'Red wins — all black pieces captured!' };
  }

  // No valid moves for the current player
  const redCanMove = teamHasAnyMoves(state.pieces, Team.RED);
  const blackCanMove = teamHasAnyMoves(state.pieces, Team.BLACK);

  if (!redCanMove && state.currentTeam === Team.RED) {
    return { isOver: true, winner: 2, result: 'no-moves', resultDisplay: 'Black wins — Red has no valid moves!' };
  }
  if (!blackCanMove && state.currentTeam === Team.BLACK) {
    return { isOver: true, winner: 1, result: 'no-moves', resultDisplay: 'Red wins — Black has no valid moves!' };
  }

  // Both stuck — draw (extremely rare in standard checkers)
  if (!redCanMove && !blackCanMove) {
    return { isOver: true, winner: null, result: 'draw', resultDisplay: 'Draw — neither player can move!' };
  }

  return { isOver: false, winner: null, result: 'in-progress', resultDisplay: '' };
}
