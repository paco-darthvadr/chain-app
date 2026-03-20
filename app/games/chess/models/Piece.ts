import { TeamType, PieceType } from "../types";
import { Position } from "./Position";

export class Piece {
    image: string;
    position: Position;
    type: PieceType;
    team: TeamType;
    possibleMoves?: Position[];
    hasMoved: boolean;
    constructor(position: Position, type: PieceType,
        team: TeamType, hasMoved: boolean,
        possibleMoves: Position[] = []) {
        // Map piece types to correct image names based on actual files
        const pieceTypeMap: { [key in PieceType]: string } = {
            [PieceType.PAWN]: 'p',
            [PieceType.ROOK]: 'r',
            [PieceType.KNIGHT]: 'kn',
            [PieceType.BISHOP]: 'b',
            [PieceType.QUEEN]: 'q',
            [PieceType.KING]: 'k'
        };
        
        const teamSuffix = team === TeamType.OUR ? 'lt' : 'dk';
        this.image = `/img/chess_${pieceTypeMap[type]}${teamSuffix}.png`;
        this.position = position;
        this.type = type;
        this.team = team;
        this.possibleMoves = possibleMoves;
        this.hasMoved = hasMoved;
    }

    get isPawn() : boolean {
        return this.type === PieceType.PAWN
    }

    get isRook() : boolean {
        return this.type === PieceType.ROOK
    }

    get isKnight() : boolean {
        return this.type === PieceType.KNIGHT
    }

    get isBishop() : boolean {
        return this.type === PieceType.BISHOP
    }

    get isKing() : boolean {
        return this.type === PieceType.KING
    }

    get isQueen() : boolean {
        return this.type === PieceType.QUEEN
    }

    samePiecePosition(otherPiece: Piece) : boolean {
        return this.position.samePosition(otherPiece.position);
    }

    samePosition(otherPosition: Position) : boolean {
        return this.position.samePosition(otherPosition);
    }

    clone(): Piece {
        return new Piece(this.position.clone(),
             this.type, this.team, this.hasMoved,
             this.possibleMoves?.map(m => m.clone()));
    }
}