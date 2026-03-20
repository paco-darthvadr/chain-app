'use client';

import { Card, CardContent } from '@/components/ui/card';
import Chessboard from '@/app/games/chess/Board';
import MoveHistory from '@/app/games/chess/MoveHistory';
import PromotionDialog from '@/app/games/chess/PromotionDialog';
import { initialBoard } from '@/app/games/chess/constants';
import { useState, useEffect } from 'react';
import { Piece, Position } from '@/app/games/chess/models';
import { TeamType, PieceType } from '@/app/games/chess/types';
import CapturedPiecesPanel from '@/app/games/chess/CapturedPiecesPanel';

interface Move {
    piece: string;
    from: string;
    to: string;
    capture?: string;
    turn: 'w' | 'b';
    promotion?: string;
}

const Game = () => {
    const [board, setBoard] = useState<typeof initialBoard | null>(null);
    const [moves, setMoves] = useState<Move[]>([]);
    const [showPromotionDialog, setShowPromotionDialog] = useState(false);
    const [pendingPromotion, setPendingPromotion] = useState<{
        piece: Piece;
        destination: Position;
    } | null>(null);

    // Initialize board properly
    useEffect(() => {
        const newBoard = initialBoard.clone();
        newBoard.calculateAllMoves();
        setBoard(newBoard);
    }, []);

    const formatPosition = (x: number, y: number) => {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        return `${files[x]}${ranks[y]}`;
    };

    const getCurrentTurn = () => {
        if (!board) return 'w';
        return board.currentTeam === TeamType.OUR ? 'w' : 'b';
    };

    const handlePromotion = (promotionType: PieceType) => {
        if (!pendingPromotion || !board) return;

        const { piece, destination } = pendingPromotion;
        
        // Create a new board state
        const newBoard = board.clone();
        
        // Find the piece in the new board
        const pieceToMove = newBoard.pieces.find(p => p.samePiecePosition(piece));
        
        if (!pieceToMove) return;

        // Check if this is a capture move
        const capturedPiece = newBoard.pieces.find(p => p.samePosition(destination));
        const isCapture = capturedPiece !== undefined;

        // Record the move
        const move: Move = {
            piece: piece.type,
            from: formatPosition(piece.position.x, piece.position.y),
            to: formatPosition(destination.x, destination.y),
            capture: capturedPiece?.type,
            turn: getCurrentTurn(),
            promotion: promotionType
        };

        // Make the move with promotion
        const success = newBoard.playMove(
            false, // enPassantMove
            true,  // validMove
            pieceToMove,
            destination,
            promotionType
        );

        if (success) {
            // Update the board state
            setBoard(newBoard);
            
            // Add move to history
            setMoves(prev => [...prev, move]);
                        
            // Play sound on move
            try {
                new Audio('/sounds/move.mp3').play();
            } catch (error) {
                console.error('Error playing move sound:', error);
            }
            
            console.log(`Pawn promoted to ${promotionType}!`);
        }

        // Close the promotion dialog
        setShowPromotionDialog(false);
        setPendingPromotion(null);
    };

    const cancelPromotion = () => {
        setShowPromotionDialog(false);
        setPendingPromotion(null);
    };

    const playMove = (piece: Piece, position: Position): boolean => {
        if (!board) return false;

        // Check if it's the correct player's turn
        if (piece.team !== board.currentTeam) {
            console.log('Not your turn!');
            return false;
        }

        // Check if the move is valid
        const validMoves = piece.possibleMoves || [];
        const isValidMove = validMoves.some(move => move.samePosition(position));
        
        if (!isValidMove) {
            console.log('Invalid move!');
            return false;
        }

        // Check if this move would result in pawn promotion
        if (piece.isPawn && board.shouldPromotePawn(piece, position)) {
            // Store the pending promotion and show dialog
            setPendingPromotion({ piece, destination: position });
            setShowPromotionDialog(true);
            return true; // Return true to indicate the move is being processed
        }

        // Create a new board state
        const newBoard = board.clone();
        
        // Find the piece in the new board
        const pieceToMove = newBoard.pieces.find(p => p.samePiecePosition(piece));
        
        if (!pieceToMove) {
            console.log('Piece not found!');
            return false;
        }

        // Check if this is a capture move
        const capturedPiece = newBoard.pieces.find(p => p.samePosition(position));
        const isCapture = capturedPiece !== undefined;

        console.log('Making move:', piece.type, 'from', piece.position.x, piece.position.y, 'to', position.x, position.y);
        console.log('Is capture:', isCapture);
        if (isCapture) {
            console.log('Capturing piece:', capturedPiece?.type, 'at', position.x, position.y);
        }

        // Record the move
        const move: Move = {
            piece: piece.type,
            from: formatPosition(piece.position.x, piece.position.y),
            to: formatPosition(position.x, position.y),
            capture: capturedPiece?.type,
            turn: getCurrentTurn()
        };

        // Make the move
        const success = newBoard.playMove(
            false, // enPassantMove
            true,  // validMove
            pieceToMove,
            position
        );

        if (success) {
            console.log('Move successful! Board pieces after move:', newBoard.pieces.length);
            
            // Update the board state
            setBoard(newBoard);
            
            // Add move to history
            setMoves(prev => [...prev, move]);

            // Play sound on move
            try {
                new Audio('/sounds/move.mp3').play();
            } catch (error) {
                console.error('Error playing move sound:', error);
            }
            
            console.log(`Move successful! ${piece.type} moved to ${position.x},${position.y}`);
            if (isCapture) {
                console.log(`Captured ${capturedPiece?.type}!`);
            }
            
            return true;
        }

        return false;
    };

    const resetGame = () => {
        const newBoard = initialBoard.clone();
        newBoard.calculateAllMoves();
        setBoard(newBoard);
        setMoves([]);
    };

    const isCheck = () => {
        if (!board) return false;
        
        // Check if the current player's king is in check
        const currentKing = board.pieces.find(p => p.isKing && p.team === board.currentTeam);
        if (!currentKing) return false;
        
        // Check if any enemy piece can attack the current king
        const enemyPieces = board.pieces.filter(p => p.team !== board.currentTeam);
        
        for (const enemyPiece of enemyPieces) {
            // Calculate valid moves for this enemy piece
            const validMoves = board.getValidMoves(enemyPiece, board.pieces);
            
            // Check if any of these moves can capture the king
            if (validMoves.some(move => move.samePosition(currentKing.position))) {
                console.log('Check detected!', enemyPiece.type, 'can attack king at', currentKing.position.x, currentKing.position.y);
                return true;
            }
        }
        
        return false;
    };

    const isCheckmate = () => {
        if (!board) return false;
        return board.winningTeam !== undefined;
    };

    const currentTurn = getCurrentTurn();

    // Don't render until board is initialized
    if (!board) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    return ( 
        <div className="flex flex-col items-center gap-4 p-4">
            <div className="flex gap-6 items-start">
                <CapturedPiecesPanel capturedPieces={board.capturedPieces} />
                <div className="flex flex-col gap-4 items-center">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Chess Game</h2>
                        {isCheckmate() && (
                            <p className="text-xl font-bold text-green-600 mt-2">
                                {board.winningTeam === 'w' ? 'White' : 'Black'} wins!
                            </p>
                        )}
                        {isCheck() && !isCheckmate() && (
                            <p className="text-lg font-bold text-yellow-600 mt-2">Check!</p>
                        )}
                    </div>
                    
                    <Chessboard pieces={board.pieces} playMove={playMove} />
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={resetGame}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            New Game
                        </button>
                        <button 
                            onClick={() => {
                                console.log('Board state:', board);
                                console.log('Current team:', board.currentTeam);
                                console.log('Total turns:', board.totalTurns);
                                console.log('All pieces:');
                                board.pieces.forEach((piece, index) => {
                                    console.log(`${index}: ${piece.type} at ${piece.position.x},${piece.position.y} (${piece.team}) - moves: ${piece.possibleMoves?.length || 0}`);
                                });
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            Debug Info
                        </button>
                    </div>
                </div>
                
                <MoveHistory 
                    moves={moves}
                    currentTurn={currentTurn}
                    isCheck={isCheck()}
                    isCheckmate={isCheckmate()}
                />
            </div>

            {showPromotionDialog && (
                <PromotionDialog
                    isVisible={showPromotionDialog}
                    team={board.currentTeam}
                    onPromote={handlePromotion}
                    onCancel={cancelPromotion}
                />
            )}
        </div>
     );
}
 
export default Game;