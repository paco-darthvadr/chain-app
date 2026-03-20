import { getPossibleBishopMoves, getPossibleKingMoves, getPossibleKnightMoves, getPossiblePawnMoves, getPossibleQueenMoves, getPossibleRookMoves, getCastlingMoves } from "../rules";
import { PieceType, TeamType } from "../types";
import { Pawn } from "./Pawn";
import { Piece } from "./Piece";
import { Position } from "./Position";

export class Board {
    pieces: Piece[];
    totalTurns: number;
    winningTeam?: TeamType;
    capturedPieces: Piece[];

    constructor(pieces: Piece[], totalTurns: number, capturedPieces: Piece[] = []) {
        this.pieces = pieces;
        this.totalTurns = totalTurns;
        this.capturedPieces = capturedPieces;
    }

    get currentTeam(): TeamType {
        return this.totalTurns % 2 === 0 ? TeamType.OUR : TeamType.OPPONENT;
    }

    // Check if a pawn should be promoted
    shouldPromotePawn(piece: Piece, destination: Position): boolean {
        if (!piece.isPawn) return false;
        
        // White pawns promote at rank 8 (y = 7), black pawns at rank 1 (y = 0)
        return (piece.team === TeamType.OUR && destination.y === 7) ||
               (piece.team === TeamType.OPPONENT && destination.y === 0);
    }

    // Promote a pawn to the specified piece type
    promotePawn(piece: Piece, promotionType: PieceType): void {
        if (!piece.isPawn) return;

        // Create a new piece of the promotion type
        const promotedPiece = new Piece(
            piece.position,
            promotionType,
            piece.team,
            true, // hasMoved
            [] // possibleMoves will be calculated later
        );

        // Replace the pawn with the promoted piece
        const pieceIndex = this.pieces.findIndex(p => p === piece);
        if (pieceIndex !== -1) {
            this.pieces[pieceIndex] = promotedPiece;
        }
    }

    calculateAllMoves() {
        console.log('=== calculateAllMoves called ===');
        console.log('Current team:', this.currentTeam);
        console.log('Total turns:', this.totalTurns);
        
        // Calculate the moves of all the pieces
        for (const piece of this.pieces) {
            const validMoves = this.getValidMoves(piece, this.pieces);
            piece.possibleMoves = validMoves;
            console.log(`${piece.type} (${piece.team}) at ${piece.position.x},${piece.position.y}: ${validMoves.length} moves`);
        }

        // Calculate castling moves
        for (const king of this.pieces.filter(p => p.isKing)) {
            if (king.possibleMoves === undefined) continue;

            king.possibleMoves = [...king.possibleMoves, ...getCastlingMoves(king, this.pieces)];
        }

        // Check if the current team moves are valid
        this.checkCurrentTeamMoves();

        // Remove the posibble moves for the team that is not playing
        console.log('Removing moves for team that is not playing...');
        for (const piece of this.pieces.filter(p => p.team !== this.currentTeam)) {
            console.log(`Removing moves from ${piece.type} (${piece.team}) at ${piece.position.x},${piece.position.y}`);
            piece.possibleMoves = [];
        }

        // Check if the playing team still has moves left
        // Otherwise, checkmate!
        const currentTeamPieces = this.pieces.filter(p => p.team === this.currentTeam);
        const hasMoves = currentTeamPieces.some(p => p.possibleMoves !== undefined && p.possibleMoves.length > 0);
        
        console.log('Current team pieces with moves:', currentTeamPieces.filter(p => p.possibleMoves && p.possibleMoves.length > 0).length);
        
        if (hasMoves) return;

        this.winningTeam = (this.currentTeam === TeamType.OUR) ? TeamType.OPPONENT : TeamType.OUR;
        console.log('Checkmate! Winner:', this.winningTeam);
    }

    checkCurrentTeamMoves() {
        // Loop through all the current team's pieces
        for (const piece of this.pieces.filter(p => p.team === this.currentTeam)) {
            if (piece.possibleMoves === undefined) continue;

            // Simulate all the piece moves
            for (const move of piece.possibleMoves) {
                const simulatedBoard = this.clone();

                // Remove the piece at the destination position
                simulatedBoard.pieces = simulatedBoard.pieces.filter(p => !p.samePosition(move));

                // Get the piece of the cloned board
                const clonedPiece = simulatedBoard.pieces.find(p => p.samePiecePosition(piece))!;
                clonedPiece.position = move.clone();

                // Get the king of the cloned board
                const clonedKing = simulatedBoard.pieces.find(p => p.isKing && p.team === simulatedBoard.currentTeam)!;

                // Loop through all enemy pieces, update their possible moves
                // And check if the current team's king will be in danger
                for (const enemy of simulatedBoard.pieces.filter(p => p.team !== simulatedBoard.currentTeam)) {
                    enemy.possibleMoves = simulatedBoard.getValidMoves(enemy, simulatedBoard.pieces);

                    if (enemy.isPawn) {
                        if (enemy.possibleMoves.some(m => m.x !== enemy.position.x
                            && m.samePosition(clonedKing.position))) {
                            piece.possibleMoves = piece.possibleMoves?.filter(m => !m.samePosition(move));
                        }
                    } else {
                        if (enemy.possibleMoves.some(m => m.samePosition(clonedKing.position))) {
                            piece.possibleMoves = piece.possibleMoves?.filter(m => !m.samePosition(move));
                        }
                    }
                }
            }
        }
    }

    getValidMoves(piece: Piece, boardState: Piece[]): Position[] {
        switch (piece.type) {
            case PieceType.PAWN:
                return getPossiblePawnMoves(piece, boardState);
            case PieceType.KNIGHT:
                return getPossibleKnightMoves(piece, boardState);
            case PieceType.BISHOP:
                return getPossibleBishopMoves(piece, boardState);
            case PieceType.ROOK:
                return getPossibleRookMoves(piece, boardState);
            case PieceType.QUEEN:
                return getPossibleQueenMoves(piece, boardState);
            case PieceType.KING:
                return getPossibleKingMoves(piece, boardState);
            default:
                return [];
        }
    }

    playMove(enPassantMove: boolean,
        validMove: boolean,
        playedPiece: Piece,
        destination: Position,
        promotionType?: PieceType): boolean {
        
        this.totalTurns++;

        const pawnDirection = playedPiece.team === TeamType.OUR ? 1 : -1;
        const destinationPiece = this.pieces.find(p => p.samePosition(destination));

        console.log('Board.playMove called:');
        console.log('- Played piece:', playedPiece.type, 'at', playedPiece.position.x, playedPiece.position.y);
        console.log('- Destination:', destination.x, destination.y);
        console.log('- Destination piece:', destinationPiece ? `${destinationPiece.type} (${destinationPiece.team})` : 'none');
        console.log('- Pieces before move:', this.pieces.length);

        // If the move is a castling move do this
        if (playedPiece.isKing && destinationPiece?.isRook
            && destinationPiece.team === playedPiece.team) {
            const direction = (destinationPiece.position.x - playedPiece.position.x > 0) ? 1 : -1;
            const newKingXPosition = playedPiece.position.x + direction * 2;
            this.pieces = this.pieces.map(p => {
                if (p === playedPiece) {
                    p.position.x = newKingXPosition;
                } else if (p === destinationPiece) {
                    p.position.x = newKingXPosition - direction;
                }

                return p;
            });

            this.calculateAllMoves();
            return true;
        }

        if (enPassantMove) {
            this.pieces = this.pieces.reduce((results, piece) => {
                if (piece === playedPiece) {
                    if (piece.isPawn)
                        (piece as Pawn).enPassant = false;
                    piece.position.x = destination.x;
                    piece.position.y = destination.y;
                    piece.hasMoved = true;
                    results.push(piece);
                } else if (
                    !piece.samePosition(new Position(destination.x, destination.y - pawnDirection))
                ) {
                    if (piece.isPawn) {
                        (piece as Pawn).enPassant = false;
                    }
                    results.push(piece);
                }

                return results;
            }, [] as Piece[]);

            this.calculateAllMoves();
            return true;
        } else if (validMove) {
            const capturedPiece = this.pieces.find(p => p.samePosition(destination));
            if (capturedPiece) {
                this.capturedPieces.push(capturedPiece);
            }
            //UPDATES THE PIECE POSITION
            //AND IF A PIECE IS ATTACKED, REMOVES IT
            const newPieces = this.pieces.reduce((results, piece) => {
                // Piece that we are currently moving
                if (piece === playedPiece) {
                    console.log('- Moving piece:', piece.type, 'to', destination.x, destination.y);
                    //SPECIAL MOVE
                    if (piece.isPawn)
                        (piece as Pawn).enPassant =
                            Math.abs(playedPiece.position.y - destination.y) === 2 &&
                            piece.type === PieceType.PAWN;
                    piece.position.x = destination.x;
                    piece.position.y = destination.y;
                    piece.hasMoved = true;
                    results.push(piece);
                } else if (!piece.samePosition(destination)) {
                    if (piece.isPawn) {
                        (piece as Pawn).enPassant = false;
                    }
                    results.push(piece);
                } else {
                    console.log('- Removing captured piece:', piece.type, 'at', piece.position.x, piece.position.y);
                }

                // The piece at the destination location
                // Won't be pushed in the results
                return results;
            }, [] as Piece[]);
            
            this.pieces = newPieces;

            // Check for pawn promotion
            const movedPiece = this.pieces.find(p => p.samePosition(destination));
            if (movedPiece && this.shouldPromotePawn(movedPiece, destination)) {
                if (promotionType) {
                    this.promotePawn(movedPiece, promotionType);
                } else {
                    // Default to queen if no promotion type specified
                    this.promotePawn(movedPiece, PieceType.QUEEN);
                }
            }

            console.log('- Pieces after move:', this.pieces.length);
            this.calculateAllMoves();
            return true;
        }

        return false;
    }

    clone(): Board {
        return new Board(this.pieces.map(p => p.clone()),
            this.totalTurns,
            this.capturedPieces.map(p => p.clone()));
    }
}