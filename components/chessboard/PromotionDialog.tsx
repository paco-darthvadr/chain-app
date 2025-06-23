'use client';

import { PieceType, TeamType } from '@/app/Types';
import { Piece } from '@/app/models/Piece';
import { Position } from '@/app/models/Position';

interface Props {
    isVisible: boolean;
    team: TeamType;
    onPromote: (promotionType: PieceType) => void;
    onCancel: () => void;
}

const PromotionDialog = ({ isVisible, team, onPromote, onCancel }: Props) => {
    if (!isVisible) return null;

    const promotionPieces = [
        { type: PieceType.QUEEN, name: 'Queen' },
        { type: PieceType.ROOK, name: 'Rook' },
        { type: PieceType.BISHOP, name: 'Bishop' },
        { type: PieceType.KNIGHT, name: 'Knight' }
    ];

    const getPieceImage = (pieceType: PieceType) => {
        const pieceTypeMap: { [key in PieceType]: string } = {
            [PieceType.PAWN]: 'p',
            [PieceType.ROOK]: 'r',
            [PieceType.KNIGHT]: 'kn',
            [PieceType.BISHOP]: 'b',
            [PieceType.QUEEN]: 'q',
            [PieceType.KING]: 'k'
        };
        
        const teamSuffix = team === TeamType.OUR ? 'lt' : 'dk';
        return `/img/chess_${pieceTypeMap[pieceType]}${teamSuffix}.png`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                <h3 className="text-lg font-bold mb-4 text-center">
                    Choose promotion piece
                </h3>
                <div className="flex gap-4 mb-4">
                    {promotionPieces.map((piece) => (
                        <button
                            key={piece.type}
                            onClick={() => onPromote(piece.type)}
                            className="flex flex-col items-center p-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                        >
                            <img
                                src={getPieceImage(piece.type)}
                                alt={piece.name}
                                className="w-12 h-12 mb-2"
                            />
                            <span className="text-sm font-medium">{piece.name}</span>
                        </button>
                    ))}
                </div>
                <div className="flex justify-center">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromotionDialog; 