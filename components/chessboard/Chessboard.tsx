'use client';

import './Chessboard.css'
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Piece, Position } from '@/app/models';
import { GRID_SIZE } from '@/app/Constants';
import { useState, useEffect } from 'react';

interface Props {
    playMove: (piece: Piece, position: Position) => boolean;
    pieces: Piece[];
}

const verticalAxis = ["1", "2", "3", "4", "5", "6", "7", "8"];
const horizontalAxis = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function Chessboard({ pieces, playMove }: Props) {
    const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const handlePieceClick = (piece: Piece) => {
        console.log('Piece clicked:', piece.type, piece.team, 'at', piece.position.x, piece.position.y);
        console.log('Possible moves:', piece.possibleMoves?.length || 0);
        
        if (selectedPiece && selectedPiece.team !== piece.team && validMoves.some(move => move.samePosition(piece.position))) {
            // This is a capture move
            const success = playMove(selectedPiece, piece.position);
            if (success) {
                setSelectedPiece(null);
                setValidMoves([]);
            }
        } else if (selectedPiece && selectedPiece.samePiecePosition(piece)) {
            // Deselect if clicking the same piece
            setSelectedPiece(null);
            setValidMoves([]);
        } else {
            // Select new piece
            setSelectedPiece(piece);
            setValidMoves(piece.possibleMoves || []);
        }
    };

    const handleTileClick = (position: Position) => {
        if (selectedPiece && validMoves.some(move => move.samePosition(position))) {
            // Make the move
            const success = playMove(selectedPiece, position);
            if (success) {
                setSelectedPiece(null);
                setValidMoves([]);
            }
        } else if (pieces.find(p => p.samePosition(position))) {
            // Clicked on a piece, select it
            const piece = pieces.find(p => p.samePosition(position))!;
            handlePieceClick(piece);
        } else {
            // Clicked on empty tile, deselect
            setSelectedPiece(null);
            setValidMoves([]);
        }
    };

    const isSelectedPiece = (piece: Piece) => {
        return selectedPiece && selectedPiece.samePiecePosition(piece);
    };

    const isValidMove = (position: Position) => {
        return validMoves.some(move => move.samePosition(position));
    };

    const isAttackMove = (position: Position) => {
        return validMoves.some(move => move.samePosition(position)) && 
               pieces.find(p => p.samePosition(position));
    };

    let board = [];

    for(let j = verticalAxis.length - 1; j >= 0; j--) {
        for (let i = 0; i < horizontalAxis.length; i++) {
            const number = j + i + 2;
            const piece = pieces.find(p => p.position.x === i && p.position.y === j);
            const position = new Position(i, j);
            
            // Create a unique key that changes when pieces change
            const pieceKey = piece ? `${piece.type}-${piece.team}-${piece.position.x}-${piece.position.y}` : 'empty';
            const tileKey = `tile-${i}-${j}-${pieceKey}`;

            if(number % 2 === 0) {
                board.push(
                    <div 
                        key={tileKey}
                        className={`tile black-tile ${isValidMove(position) ? 'valid-move' : ''}`}
                        style={{
                            width: GRID_SIZE,
                            height: GRID_SIZE,
                            position: 'relative',
                            cursor: 'pointer'
                        }}
                        onClick={() => handleTileClick(position)}
                    >
                        {piece && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePieceClick(piece);
                                }}
                                className={`piece ${isSelectedPiece(piece) ? 'selected' : ''}`}
                                style={{
                                    width: GRID_SIZE,
                                    height: GRID_SIZE,
                                    backgroundImage: `url(${piece.image})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    cursor: 'grab',
                                    transition: 'transform 0.2s ease'
                                }}
                            />
                        )}
                        {isValidMove(position) && !piece && (
                            <div
                                className="move-indicator"
                                style={{
                                    width: GRID_SIZE * 0.3,
                                    height: GRID_SIZE * 0.3,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(0, 255, 0, 0.3)',
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    pointerEvents: 'none'
                                }}
                            />
                        )}
                        {isAttackMove(position) && piece && (
                            <div
                                className="attack-indicator"
                                style={{
                                    width: GRID_SIZE,
                                    height: GRID_SIZE,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255, 0, 0, 0.4)',
                                    border: '3px solid rgba(255, 0, 0, 0.8)',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    pointerEvents: 'none',
                                    animation: 'pulse 1s infinite'
                                }}
                            />
                        )}
                    </div>
                );
            } else {
                board.push(
                    <div 
                        key={tileKey}
                        className={`tile white-tile ${isValidMove(position) ? 'valid-move' : ''}`}
                        style={{
                            width: GRID_SIZE,
                            height: GRID_SIZE,
                            position: 'relative',
                            cursor: 'pointer'
                        }}
                        onClick={() => handleTileClick(position)}
                    >
                        {piece && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePieceClick(piece);
                                }}
                                className={`piece ${isSelectedPiece(piece) ? 'selected' : ''}`}
                                style={{
                                    width: GRID_SIZE,
                                    height: GRID_SIZE,
                                    backgroundImage: `url(${piece.image})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    cursor: 'grab',
                                    transition: 'transform 0.2s ease'
                                }}
                            />
                        )}
                        {isValidMove(position) && !piece && (
                            <div
                                className="move-indicator"
                                style={{
                                    width: GRID_SIZE * 0.3,
                                    height: GRID_SIZE * 0.3,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(0, 255, 0, 0.3)',
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    pointerEvents: 'none'
                                }}
                            />
                        )}
                        {isAttackMove(position) && piece && (
                            <div
                                className="attack-indicator"
                                style={{
                                    width: GRID_SIZE,
                                    height: GRID_SIZE,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255, 0, 0, 0.4)',
                                    border: '3px solid rgba(255, 0, 0, 0.8)',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    pointerEvents: 'none',
                                    animation: 'pulse 1s infinite'
                                }}
                            />
                        )}
                    </div>
                );
            }
        }
    }
    
    return ( 
        <>
        <div>
            <div>
                <Card id='boardcard' className='bg-slate-100 dark:bg-slate-800 flex'>
                    <CardContent>
                    <div 
                        id="chessboard" 
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(8, 1fr)',
                            width: GRID_SIZE * 8,
                            height: GRID_SIZE * 8
                        }}
                    >
                        {board}
                    </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </>
    );
}
 