import { Piece } from "./models/Piece";
import { Position } from "./models/Position";
import { PieceType, TeamType } from "./types";

export const getPossiblePawnMoves = (pawn: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [];
    const specialRow = pawn.team === TeamType.OUR ? 1 : 6;
    const pawnDirection = pawn.team === TeamType.OUR ? 1 : -1;

    const normalMove = new Position(pawn.position.x, pawn.position.y + pawnDirection);
    const specialMove = new Position(pawn.position.x, pawn.position.y + pawnDirection * 2);
    const upperLeftAttack = new Position(pawn.position.x - 1, pawn.position.y + pawnDirection);
    const upperRightAttack = new Position(pawn.position.x + 1, pawn.position.y + pawnDirection);

    if (!boardState.find(p => p.samePosition(normalMove))) {
        possibleMoves.push(normalMove);

        if (pawn.position.y === specialRow && !boardState.find(p => p.samePosition(specialMove))) {
            possibleMoves.push(specialMove);
        }
    }

    for (const attackMove of [upperLeftAttack, upperRightAttack]) {
        if (boardState.find(p => p.samePosition(attackMove) && p.team !== pawn.team)) {
            possibleMoves.push(attackMove);
        }
    }

    return possibleMoves;
};

export const getPossibleKnightMoves = (knight: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [];
    for (let i = -1; i < 2; i += 2) {
        for (let j = -1; j < 2; j += 2) {
            const verticalMove = new Position(knight.position.x + j, knight.position.y + i * 2);
            const horizontalMove = new Position(knight.position.x + i * 2, knight.position.y + j);

            if (verticalMove.withinBoard() && !boardState.find(p => p.samePosition(verticalMove) && p.team === knight.team)) {
                possibleMoves.push(verticalMove);
            }
            if (horizontalMove.withinBoard() && !boardState.find(p => p.samePosition(horizontalMove) && p.team === knight.team)) {
                possibleMoves.push(horizontalMove);
            }
        }
    }
    return possibleMoves;
};

export const getPossibleBishopMoves = (bishop: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [];
    for (let i = 1; i < 8; i++) {
        const upperRight = new Position(bishop.position.x + i, bishop.position.y + i);
        const bottomLeft = new Position(bishop.position.x - i, bishop.position.y - i);
        const upperLeft = new Position(bishop.position.x - i, bishop.position.y + i);
        const bottomRight = new Position(bishop.position.x + i, bishop.position.y - i);

        if (!upperRight.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(upperRight))) {
            possibleMoves.push(upperRight);
        } else if (boardState.find(p => p.samePosition(upperRight) && p.team !== bishop.team)) {
            possibleMoves.push(upperRight);
            break;
        } else {
            break;
        }
    }

    for (let i = 1; i < 8; i++) {
        const bottomLeft = new Position(bishop.position.x - i, bishop.position.y - i);
        if (!bottomLeft.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(bottomLeft))) {
            possibleMoves.push(bottomLeft);
        } else if (boardState.find(p => p.samePosition(bottomLeft) && p.team !== bishop.team)) {
            possibleMoves.push(bottomLeft);
            break;
        } else {
            break;
        }
    }

    for (let i = 1; i < 8; i++) {
        const upperLeft = new Position(bishop.position.x - i, bishop.position.y + i);
        if (!upperLeft.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(upperLeft))) {
            possibleMoves.push(upperLeft);
        } else if (boardState.find(p => p.samePosition(upperLeft) && p.team !== bishop.team)) {
            possibleMoves.push(upperLeft);
            break;
        } else {
            break;
        }
    }

    for (let i = 1; i < 8; i++) {
        const bottomRight = new Position(bishop.position.x + i, bishop.position.y - i);
        if (!bottomRight.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(bottomRight))) {
            possibleMoves.push(bottomRight);
        } else if (boardState.find(p => p.samePosition(bottomRight) && p.team !== bishop.team)) {
            possibleMoves.push(bottomRight);
            break;
        } else {
            break;
        }
    }

    return possibleMoves;
};

export const getPossibleRookMoves = (rook: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [];
    for (let i = 1; i < 8; i++) {
        const upperMove = new Position(rook.position.x, rook.position.y + i);
        const rightMove = new Position(rook.position.x + i, rook.position.y);
        const bottomMove = new Position(rook.position.x, rook.position.y - i);
        const leftMove = new Position(rook.position.x - i, rook.position.y);

        if (!upperMove.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(upperMove))) {
            possibleMoves.push(upperMove);
        } else if (boardState.find(p => p.samePosition(upperMove) && p.team !== rook.team)) {
            possibleMoves.push(upperMove);
            break;
        } else {
            break;
        }
    }

    for (let i = 1; i < 8; i++) {
        const rightMove = new Position(rook.position.x + i, rook.position.y);
        if (!rightMove.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(rightMove))) {
            possibleMoves.push(rightMove);
        } else if (boardState.find(p => p.samePosition(rightMove) && p.team !== rook.team)) {
            possibleMoves.push(rightMove);
            break;
        } else {
            break;
        }
    }

    for (let i = 1; i < 8; i++) {
        const bottomMove = new Position(rook.position.x, rook.position.y - i);
        if (!bottomMove.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(bottomMove))) {
            possibleMoves.push(bottomMove);
        } else if (boardState.find(p => p.samePosition(bottomMove) && p.team !== rook.team)) {
            possibleMoves.push(bottomMove);
            break;
        } else {
            break;
        }
    }

    for (let i = 1; i < 8; i++) {
        const leftMove = new Position(rook.position.x - i, rook.position.y);
        if (!leftMove.withinBoard()) break;
        if (!boardState.find(p => p.samePosition(leftMove))) {
            possibleMoves.push(leftMove);
        } else if (boardState.find(p => p.samePosition(leftMove) && p.team !== rook.team)) {
            possibleMoves.push(leftMove);
            break;
        } else {
            break;
        }
    }

    return possibleMoves;
};

export const getPossibleQueenMoves = (queen: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [
        ...getPossibleBishopMoves(queen, boardState),
        ...getPossibleRookMoves(queen, boardState)
    ];
    return possibleMoves;
};

export const getPossibleKingMoves = (king: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [];
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            const newPosition = new Position(king.position.x + j, king.position.y + i);
            if (newPosition.withinBoard() && !boardState.find(p => p.samePosition(newPosition) && p.team === king.team)) {
                possibleMoves.push(newPosition);
            }
        }
    }
    return possibleMoves;
};

export const getCastlingMoves = (king: Piece, boardState: Piece[]): Position[] => {
    const possibleMoves: Position[] = [];
    if (king.hasMoved) return possibleMoves;

    const rooks = boardState.filter(p => p.isRook && p.team === king.team && !p.hasMoved);
    for (const rook of rooks) {
        const direction = rook.position.x - king.position.x > 0 ? 1 : -1;
        const adjacent = king.position.x + direction;
        if (boardState.find(p => p.samePosition(new Position(adjacent, king.position.y)))) continue;
        if (boardState.find(p => p.samePosition(new Position(adjacent + direction, king.position.y)))) continue;
        const newKingPosition = new Position(king.position.x + direction * 2, king.position.y);
        possibleMoves.push(newKingPosition);
    }
    return possibleMoves;
}; 