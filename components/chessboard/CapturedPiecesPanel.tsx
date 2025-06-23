'use client';

import { Piece } from "@/app/models/Piece";
import { TeamType } from "@/app/Types";

interface Props {
    capturedPieces: Piece[];
}

const CapturedPiecesPanel = ({ capturedPieces }: Props) => {
    // Pieces captured by White are Black pieces
    const piecesCapturedByWhite = capturedPieces.filter(p => p.team === TeamType.OPPONENT);

    // Pieces captured by Black are White pieces
    const piecesCapturedByBlack = capturedPieces.filter(p => p.team === TeamType.OUR);

    const renderCapturedPieces = (pieces: Piece[]) => {
        return (
            <div className="flex flex-col gap-1 min-h-[32px]">
                {pieces.map((piece, index) => (
                    <img key={index} src={piece.image} alt={piece.type} className="w-8 h-8" />
                ))}
            </div>
        );
    }

    return (
        <div className="p-4 rounded-lg bg-card border border-border w-auto">
            <div className="flex flex-row gap-8">
                <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">W</span>
                    {renderCapturedPieces(piecesCapturedByWhite)}
                </div>
                <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">B</span>
                    {renderCapturedPieces(piecesCapturedByBlack)}
                </div>
            </div>
        </div>
    );
}

export default CapturedPiecesPanel; 