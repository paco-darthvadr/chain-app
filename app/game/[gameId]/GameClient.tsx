'use client';

import Chessboard from '../../../components/chessboard/Chessboard';
import MoveHistory from '../../../components/chessboard/MoveHistory';
import PromotionDialog from '../../../components/chessboard/PromotionDialog';
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Piece } from '../../models/Piece';
import { Position } from '../../models/Position';
import { Board } from '../../models/Board';
import { TeamType, PieceType } from '../../Types';
import CapturedPiecesPanel from '@/components/chessboard/CapturedPiecesPanel';
import { getGame, updateBoardState, declareWinner } from './actions';
import { Pawn } from '../../models/Pawn';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import GameOver from '@/components/chessboard/GameOver';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Move {
    piece: string;
    from: string;
    to: string;
    capture?: string;
    turn: 'w' | 'b';
    promotion?: string;
}

interface GameClientProps {
    game: any; // Using any for now due to Prisma type issues
}

let socket: Socket;

// Function to hydrate plain JSON objects into class instances
function createBoardFromState(state: any): Board {
    const hydratePiece = (p: any) => {
        if (p.type === PieceType.PAWN) {
            return new Pawn(new Position(p.position.x, p.position.y), p.team, p.hasMoved, p.enPassant);
        }
        return new Piece(new Position(p.position.x, p.position.y), p.type, p.team, p.hasMoved);
    };

    const hydratedPieces = state.pieces.map(hydratePiece);
    const hydratedCapturedPieces = state.capturedPieces.map(hydratePiece);

    return new Board(hydratedPieces, state.totalTurns, hydratedCapturedPieces);
}

const GameClient = ({ game }: GameClientProps) => {
    const [gameState, setGame] = useState(game);
    const [board, setBoard] = useState<Board | null>(null);
    const [moves, setMoves] = useState<Move[]>([]);
    const [showPromotionDialog, setShowPromotionDialog] = useState(false);
    const [pendingPromotion, setPendingPromotion] = useState<{
        piece: Piece;
        destination: Position;
    } | null>(null);
    const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black' | null>(null);
    const [playerVerusId, setPlayerVerusId] = useState<string>('');
    const [gameResult, setGameResult] = useState<string | null>(null);
    const [winner, setWinner] = useState<any | null>(null);
    const [rematchOffered, setRematchOffered] = useState(false);
    const [incomingRematch, setIncomingRematch] = useState(false);
    const router = useRouter();
    
    useEffect(() => {
        // Initialize socket connection
        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://192.168.0.162:3001';
        socket = io(socketURL);

        // Join the game-specific room
        socket.emit('joinGameRoom', game.id);

        // Listen for board updates from the server
        socket.on('update-board-state', (newBoardState) => {
            if (gameResult) return; // Don't update board if game is over
            console.log("Received board state update from server.");
            const newBoard = createBoardFromState(newBoardState);
            newBoard.calculateAllMoves();
            setBoard(newBoard);
            // Also update the main game object if necessary, for example, to get new totalTurns
            setGame((prevGame: any) => ({ ...prevGame, boardState: newBoardState }));
        });

        socket.on('opponent-left', async ({ leaverId }) => {
            if (playerVerusId) {
                const isOpponent = (currentPlayer === 'white' && game.blackPlayer.verusId === leaverId) ||
                                 (currentPlayer === 'black' && game.whitePlayer.verusId === leaverId);
                
                if (isOpponent) {
                    const winnerData = currentPlayer === 'white' ? game.whitePlayer : game.blackPlayer;
                    setWinner(winnerData);
                    setGameResult('walkover');
                    await declareWinner(game.id, winnerData.id);
                }
            }
        });

        socket.on('rematch-offered', () => {
            setIncomingRematch(true);
        });

        socket.on('rematch-confirmed', ({ newGameId }) => {
            router.push(`/game/${newGameId}`);
        });

        return () => {
            socket.emit('leave-game', { gameId: game.id });
            socket.disconnect();
        };
    }, [game.id, playerVerusId, currentPlayer, router]);

    // Initialize and synchronize board state
    useEffect(() => {
        if (game.boardState) {
            const newBoard = createBoardFromState(game.boardState);
            newBoard.calculateAllMoves();
            setBoard(newBoard);
            
            if (newBoard.winningTeam) {
                const winnerData = newBoard.winningTeam === TeamType.OUR ? game.whitePlayer : game.blackPlayer;
                setWinner(winnerData);
                setGameResult('checkmate');
            }
        }
    }, [game.boardState, game.whitePlayer, game.blackPlayer]);

    const formatPosition = (x: number, y: number) => {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        return `${files[x]}${ranks[y]}`;
    };

    const getCurrentTurn = () => {
        if (!board) return 'w';
        return board.currentTeam === TeamType.OUR ? 'w' : 'b';
    };

    const isCheck = () => {
        if (!board) return false;
        
        const king = board.pieces.find(p => p.isKing && p.team === board.currentTeam);
        if (!king) return false;

        const enemyPieces = board.pieces.filter(p => p.team !== board.currentTeam);
        
        // Temporarily calculate moves for enemy pieces to see if they can attack the king
        for (const enemy of enemyPieces) {
            const moves = board.getValidMoves(enemy, board.pieces);
            if (moves.some(move => move.samePosition(king.position))) {
                return true;
            }
        }
        return false;
    };

    const isCheckmate = () => {
        if (!board) return false;
        if (board.winningTeam) {
            const winnerData = board.winningTeam === TeamType.OUR ? game.whitePlayer : game.blackPlayer;
            if (!winner) setWinner(winnerData);
            if (!gameResult) setGameResult('checkmate');
        }
        return board.winningTeam !== undefined;
    };

    async function handlePlayMove(newBoard: Board, move: Move) {
        if (gameResult) return; // Don't allow moves if game is over
        
        // Optimistically update the board for a smoother UI feel, but the server is the source of truth.
        setBoard(newBoard);
        setMoves(prev => [...prev, move]);

        // Create a plain object for the board state to send as JSON
        const newBoardState = {
            pieces: newBoard.pieces.map(p => {
                const piece: any = {
                    position: { x: p.position.x, y: p.position.y },
                    type: p.type,
                    team: p.team,
                    hasMoved: p.hasMoved,
                };
                if (p.isPawn) {
                    piece.enPassant = (p as any).enPassant;
                }
                return piece;
            }),
            totalTurns: newBoard.totalTurns,
            capturedPieces: newBoard.capturedPieces.map(p => ({
                position: { x: p.position.x, y: p.position.y },
                type: p.type,
                team: p.team,
                hasMoved: p.hasMoved,
            })),
            winningTeam: newBoard.winningTeam,
            currentTeam: newBoard.currentTeam,
        };
        
        const updatedGame = await updateBoardState(game.id, newBoardState);

        if (updatedGame && updatedGame.boardState) {
            // The server has confirmed the move and returned the new authoritative state.
            // We now update our local state to match the server's state.
            const authoritativeBoard = createBoardFromState(updatedGame.boardState);
            authoritativeBoard.calculateAllMoves();
            setBoard(authoritativeBoard);
            setGame(updatedGame);

            // Emit the move to the other player
            if (socket) {
                socket.emit('move-made', { gameId: game.id, boardState: updatedGame.boardState });
            }
        } else {
            // If the update failed, we should consider reverting the optimistic update.
            // For now, we'll log an error. A more robust solution could involve
            // refetching the game state or showing an error to the user.
            console.error("Failed to update board state on the server.");
            // Revert to the previous state by refetching
            const pristineGame = await getGame(game.id);
            if (pristineGame && pristineGame.boardState) {
                const pristineBoard = createBoardFromState(pristineGame.boardState);
                pristineBoard.calculateAllMoves();
                setBoard(pristineBoard);
                setGame(pristineGame);
            }
        }
    }

    const handleRematch = () => {
        setRematchOffered(true);
        socket.emit('rematch-offer', { gameId: game.id });
    };

    const handleAcceptRematch = () => {
        socket.emit('rematch-accept', { gameId: game.id });
    };

    const handlePromotion = (promotionType: PieceType) => {
        if (!pendingPromotion || !board) return;

        const { piece, destination } = pendingPromotion;
        
        const newBoard = board.clone();
        const pieceToMove = newBoard.pieces.find(p => p.samePiecePosition(piece));
        if (!pieceToMove) return;

        const capturedPiece = newBoard.pieces.find(p => p.samePosition(destination));

        const move: Move = {
            piece: piece.type,
            from: formatPosition(piece.position.x, piece.position.y),
            to: formatPosition(destination.x, destination.y),
            capture: capturedPiece?.type,
            turn: getCurrentTurn(),
            promotion: promotionType
        };

        const success = newBoard.playMove(false, true, pieceToMove, destination, promotionType);

        if (success) {
            handlePlayMove(newBoard, move);
        }

        setShowPromotionDialog(false);
        setPendingPromotion(null);
    };

    const cancelPromotion = () => {
        setShowPromotionDialog(false);
        setPendingPromotion(null);
    };

    const playMove = (piece: Piece, position: Position): boolean => {
        if (gameResult || !board || piece.team !== board.currentTeam) return false;

        const isWhiteTurn = board.currentTeam === TeamType.OUR;
        const isCurrentPlayerTurn = (currentPlayer === 'white' && isWhiteTurn) || (currentPlayer === 'black' && !isWhiteTurn);
        
        if (!isCurrentPlayerTurn) {
            alert("It's not your turn!");
            return false;
        }

        const validMoves = piece.possibleMoves || [];
        const isValidMove = validMoves.some(move => move.samePosition(position));
        if (!isValidMove) return false;

        if (piece.isPawn && board.shouldPromotePawn(piece, position)) {
            setPendingPromotion({ piece, destination: position });
            setShowPromotionDialog(true);
            return true;
        }

        const newBoard = board.clone();
        const pieceToMove = newBoard.pieces.find(p => p.samePiecePosition(piece));
        if (!pieceToMove) return false;

        const capturedPiece = newBoard.pieces.find(p => p.samePosition(position));

        const move: Move = {
            piece: piece.type,
            from: formatPosition(piece.position.x, piece.position.y),
            to: formatPosition(position.x, position.y),
            capture: capturedPiece?.type,
            turn: getCurrentTurn()
        };

        const success = newBoard.playMove(false, true, pieceToMove, position);

        if (success) {
            handlePlayMove(newBoard, move);
            return true;
        }

        return false;
    };
    
    const resetGame = () => {
       // This needs to be adapted for the new flow, disabling for now
       alert("Resetting the game is not supported in online mode yet.");
    };

    const currentTurn = getCurrentTurn();

    // Function to handle player identification
    const handlePlayerSelect = (verusId: string) => {
        const selectedUser = verusId === game.whitePlayer.verusId ? game.whitePlayer : game.blackPlayer;
        setPlayerVerusId(selectedUser.displayName || selectedUser.verusId);

        if (verusId === game.whitePlayer.verusId) {
            setCurrentPlayer('white');
        } else if (verusId === game.blackPlayer.verusId) {
            setCurrentPlayer('black');
        } else {
            setCurrentPlayer(null);
        }
    };
    
    // Render player selection screen if a player hasn't been identified
    if (!currentPlayer) {
        return (
            <div className="flex justify-center items-center h-screen bg-background text-foreground">
                <div className="w-full max-w-lg p-8 bg-card rounded-xl shadow-lg border">
                    <h2 className="text-2xl font-bold mb-4 text-center">Who is Playing?</h2>
                    <p className="text-muted-foreground mb-6 text-center">
                        Select your profile to begin the game.
                    </p>
                    <div className="flex justify-around gap-4">
                        {[game.whitePlayer, game.blackPlayer].map((player, index) => (
                            <button 
                                key={player.id}
                                onClick={() => handlePlayerSelect(player.verusId)}
                                className="flex flex-col items-center gap-3 p-6 rounded-lg border hover:bg-muted w-1/2"
                            >
                                <Avatar className="w-16 h-16">
                                    <AvatarImage src={player.avatarUrl} />
                                    <AvatarFallback>{(player.displayName || player.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <p className="font-bold text-lg">{player.displayName || player.verusId}</p>
                                <p className="text-sm text-muted-foreground">{index === 0 ? '(White)' : '(Black)'}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
  
    if (!board) {
        return <div className="flex justify-center items-center h-screen">Loading Game {game.id}...</div>;
    }
  
    return (
        <div className="flex flex-col md:flex-row gap-4 p-4 max-w-7xl mx-auto">
            {winner && gameResult && (
                <GameOver 
                    winnerName={winner.displayName || winner.verusId}
                    onRematch={handleRematch}
                    rematchOffered={rematchOffered}
                />
            )}
            {incomingRematch && !gameResult && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                     <div className="bg-card p-8 rounded-lg shadow-xl text-center border">
                         <h2 className="text-2xl font-bold mb-4">Your opponent offers a rematch!</h2>
                         <div className="flex justify-center gap-4 mt-6">
                             <Button onClick={handleAcceptRematch}>Accept</Button>
                             <Button variant="destructive" onClick={() => setIncomingRematch(false)}>Decline</Button>
                         </div>
                     </div>
                 </div>
            )}
            <div className="md:w-auto">
                <div className="mb-4 p-4 bg-card rounded-lg border shadow-sm text-center">
                    <h2 className="text-xl font-semibold">
                        {game.whitePlayer.displayName || game.whitePlayer.verusId} (White) vs {game.blackPlayer.displayName || game.blackPlayer.verusId} (Black)
                    </h2>
                    <p className="text-sm font-medium mt-1">
                        You are: <span className="font-bold">{playerVerusId} ({currentPlayer})</span>
                    </p>
                </div>
                <Chessboard
                    pieces={board.pieces}
                    playMove={playMove}
                />
            </div>
            <div className="md:w-80 flex flex-col gap-4">
                <MoveHistory 
                    moves={moves} 
                    currentTurn={getCurrentTurn()} 
                    isCheck={isCheck()} 
                    isCheckmate={isCheckmate()} 
                />
                <CapturedPiecesPanel 
                    capturedPieces={board.capturedPieces}
                />
            </div>
            <PromotionDialog 
                isVisible={showPromotionDialog && !gameResult}
                onPromote={handlePromotion}
                onCancel={cancelPromotion}
                team={pendingPromotion?.piece.team === TeamType.OUR ? TeamType.OUR : TeamType.OPPONENT}
            />
        </div>
    );
};

export default GameClient; 