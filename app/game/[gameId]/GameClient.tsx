'use client';

import Chessboard from '@/app/games/chess/Board';
import MoveHistory from '@/app/games/chess/MoveHistory';
import PromotionDialog from '@/app/games/chess/PromotionDialog';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { io, Socket } from 'socket.io-client';
import { Piece } from '@/app/games/chess/models/Piece';
import { Position } from '@/app/games/chess/models/Position';
import { Board } from '@/app/games/chess/models/Board';
import { TeamType, PieceType } from '@/app/games/chess/types';
import CapturedPiecesPanel from '@/app/games/chess/CapturedPiecesPanel';
import { getGame, updateGame, endGame } from './actions';
import { Pawn } from '@/app/games/chess/models/Pawn';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import GameOver from '@/components/game/GameOver';
import GameMoves from '@/components/game/GameMoves';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SubIdStatus from '@/components/game/SubIdStatus';
import ShowcaseSigningPrompt from '@/components/game/ShowcaseSigningPrompt';
import { getGameConfig } from '@/app/games/registry';

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

// ---------------------------------------------------------------------------
// GenericGameClient — renders any non-chess game using the registry's board
// ---------------------------------------------------------------------------
function GenericGameClient({ game }: { game: any }) {
    const gameType = game.gameType || 'chess';
    const config = getGameConfig(gameType);
    const BoardComponent = config.BoardComponent;

    const [gameState, setGameState] = useState(game);
    const [boardState, setBoardState] = useState(game.boardState);
    const [currentPlayer, setCurrentPlayer] = useState<1 | 2 | null>(null);
    const [gameResult, setGameResult] = useState<string | null>(null);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const router = useRouter();
    const hasUpdatedGameStatus = useRef(false);

    const playerVerusId = typeof window !== 'undefined'
        ? localStorage.getItem('currentUser') || '' : '';

    // Determine if current user is player 1 or 2
    useEffect(() => {
        if (playerVerusId && game) {
            if (game.player1Id === playerVerusId) setCurrentPlayer(1);
            else if (game.player2Id === playerVerusId) setCurrentPlayer(2);
        }
    }, [playerVerusId, game]);

    // Socket connection
    useEffect(() => {
        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL;
        const newSocket = io(socketURL);
        setSocket(newSocket);

        if (playerVerusId) {
            newSocket.emit('register-user', playerVerusId);
        }
        newSocket.emit('joinGameRoom', game.id);

        newSocket.on('update-board-state', (newBoardState: any) => {
            if (gameResult) return;
            setBoardState(newBoardState);
            setGameState((prev: any) => ({ ...prev, boardState: newBoardState }));
            // move string comes via separate 'move-string' event

            // Check if the received state ends the game
            const status = config.getGameStatus(newBoardState);
            if (status.isOver && !hasUpdatedGameStatus.current) {
                hasUpdatedGameStatus.current = true;
                setGameResult(status.resultDisplay);
            }

            try {
                new Audio('/sounds/move.mp3').play().catch(() => {});
            } catch (_) { /* ignore */ }
        });

        newSocket.on('move-string', (moveStr: string) => {
            setMoveHistory(prev => [...prev, moveStr]);
        });

        newSocket.on('opponent-resigned', async () => {
            if (!hasUpdatedGameStatus.current) {
                const updatedGame = await getGame(game.id);
                if (updatedGame && updatedGame.status === 'COMPLETED') {
                    hasUpdatedGameStatus.current = true;
                    setGameState(updatedGame);
                    setGameResult('resignation');
                }
            }
        });

        newSocket.on('rematch-offered', () => {
            // TODO: generic rematch UI
        });

        newSocket.on('rematch-confirmed', ({ newGameId }: { newGameId: string }) => {
            router.push(`/game/${newGameId}`);
        });

        return () => {
            newSocket.emit('leave-game', { gameId: game.id });
            newSocket.disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.id, playerVerusId]);

    // Check for completed game on mount
    useEffect(() => {
        if (gameState.status === 'COMPLETED' && !gameResult) {
            const status = config.getGameStatus(boardState);
            if (status.isOver) {
                setGameResult(status.resultDisplay);
            } else {
                setGameResult('Game over');
            }
        }
    }, [gameState.status, boardState, config, gameResult]);

    // Handle move
    const handleMove = useCallback(async (move: string, newBoardState: any) => {
        if (gameResult) return;
        setBoardState(newBoardState);
        setMoveHistory(prev => [...prev, move]);

        // Save to DB
        const result = await updateGame(game.id, newBoardState, {
            move,
            player: playerVerusId,
        });

        // Emit to opponent (include move string for their sidebar)
        if (socket) {
            socket.emit('move-made', {
                gameId: game.id,
                boardState: newBoardState,
                moveString: move,
                signedPackage: (result as any)?.signedPackage || null,
            });
        }

        // Check game over
        const status = config.getGameStatus(newBoardState);
        if (status.isOver && !hasUpdatedGameStatus.current) {
            hasUpdatedGameStatus.current = true;
            const winningPlayer = status.winner || 'DRAW';
            await endGame(game.id, winningPlayer);
            setGameResult(status.resultDisplay);
        }
    }, [socket, playerVerusId, game.id, config, gameResult]);

    const handleResign = async () => {
        if (!socket || !currentPlayer || gameResult) return;
        const confirmResign = window.confirm('Are you sure you want to resign?');
        if (!confirmResign) return;

        const winningPlayer: 1 | 2 = currentPlayer === 1 ? 2 : 1;
        const updatedGame = await endGame(game.id, winningPlayer);
        if (updatedGame) {
            setGameState(updatedGame);
            setGameResult(`${currentPlayer === 1 ? config.player1Label : config.player2Label} resigned`);
            socket.emit('player-resigned', { gameId: game.id, resignerId: playerVerusId });
        }
    };

    // Player selection screen if not identified yet
    if (!currentPlayer) {
        return (
            <div className="flex justify-center items-center h-screen bg-background text-foreground">
                <div className="w-full max-w-lg p-8 bg-card rounded-xl shadow-lg border">
                    <h2 className="text-2xl font-bold mb-4 text-center">Who is Playing?</h2>
                    <p className="text-muted-foreground mb-6 text-center">
                        Select your profile to begin the game.
                    </p>
                    <div className="flex justify-around gap-4">
                        {[gameState.player1, gameState.player2].map((player: any, index: number) => (
                            <button
                                key={player.id}
                                onClick={() => setCurrentPlayer(index === 0 ? 1 : 2)}
                                className="flex flex-col items-center gap-3 p-6 rounded-lg border hover:bg-muted w-1/2"
                            >
                                <p className="font-bold text-lg">{player.displayName || player.verusId}</p>
                                <p className="text-sm text-muted-foreground">
                                    ({index === 0 ? config.player1Label : config.player2Label})
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Map numeric player to 'white'|'black' for GameOver compatibility
    const currentPlayerColor: 'white' | 'black' = currentPlayer === 1 ? 'white' : 'black';

    return (
        <div className="flex flex-col md:flex-row gap-4 p-4 max-w-7xl mx-auto">
            {gameResult && (
                <GameOver
                    game={gameState}
                    winnerName={gameResult}
                    onRematch={() => {
                        if (socket) {
                            const opponentId = currentPlayer === 1 ? game.player2?.id : game.player1?.id;
                            socket.emit('rematch-offer', { gameId: game.id, opponentId });
                        }
                    }}
                    rematchOffered={false}
                    currentPlayer={currentPlayerColor}
                />
            )}
            <div className="md:w-auto">
                <div className="flex flex-row items-center justify-center gap-8 mx-auto">
                    <div className="flex flex-col items-center gap-4">
                        <Suspense fallback={<div>Loading board...</div>}>
                            <BoardComponent
                                boardState={boardState}
                                currentPlayer={currentPlayer}
                                onMove={handleMove}
                                boardTheme={gameState.boardTheme || 'classic'}
                                logoMode={gameState.logoMode || 'off'}
                                disabled={!!gameResult}
                            />
                        </Suspense>
                        {!gameResult && (
                            <Button variant="destructive" size="sm" onClick={handleResign}>
                                Resign
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {config.SidebarComponent && (
                <div className="flex flex-row gap-6 ml-auto" style={{ minWidth: '320px', maxWidth: '400px' }}>
                    <div style={{ width: '320px' }}>
                        <SubIdStatus gameId={gameState.id} mode={(gameState as any).mode || 'original'} />
                        <Suspense fallback={null}>
                            <config.SidebarComponent
                                boardState={boardState}
                                moves={moveHistory}
                                currentPlayer={currentPlayer}
                            />
                        </Suspense>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// GameClient — the main chess-specific client (unchanged below this point)
// ---------------------------------------------------------------------------
const GameClient = ({ game }: GameClientProps) => {
    const gameType = game.gameType || 'chess';

    // For non-chess games, use the generic board from the registry
    if (gameType !== 'chess') {
        return <GenericGameClient game={game} />;
    }

    const [gameState, setGameState] = useState(game);
    const [board, setBoard] = useState<Board | null>(null);
    const [moves, setMoves] = useState<Move[]>([]);
    const [showPromotionDialog, setShowPromotionDialog] = useState(false);
    const [pendingPromotion, setPendingPromotion] = useState<{
        piece: Piece;
        destination: Position;
    } | null>(null);
    const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black' | null>(null);
    const [playerVerusId, setPlayerVerusId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('currentUser') || '';
        }
        return '';
    });
    const [gameResult, setGameResult] = useState<string | null>(null);
    const [winner, setWinner] = useState<any | null>(null);
    const [rematchOffered, setRematchOffered] = useState(false);
    const [incomingRematch, setIncomingRematch] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [blockchainStatus, setBlockchainStatus] = useState<Record<string, 'storing' | 'processing' | 'stored' | 'failed' | null>>({});
    const [showcaseSigningPhase, setShowcaseSigningPhase] = useState<'open' | 'close' | null>(null);
    const [showcaseMessage, setShowcaseMessage] = useState<string>('');
    const [showcaseReady, setShowcaseReady] = useState(false);
    const showcaseOnSigned = useCallback(() => {}, []);
    const showcaseOnBothSigned = useCallback(() => {
      setShowcaseSigningPhase(null);
      setShowcaseReady(true);
    }, []);
    const router = useRouter();
    
    // Ref to track if we've already updated the game status to prevent duplicate database updates
    const hasUpdatedGameStatus = useRef<boolean>(false);

    useEffect(() => {
        // Initialize socket connection
        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL;
        console.log('Connecting to socket server at:', socketURL); // Debug
        const newSocket = io(socketURL);
        setSocket(newSocket);

        // Register user if playerVerusId is already known
        if (playerVerusId) {
            newSocket.emit('register-user', playerVerusId);
            console.log('Registering user on socket connect:', playerVerusId);
        }

        // Join the game-specific room
        newSocket.emit('joinGameRoom', gameState.id);

        // Listen for board updates from the server
        newSocket.on('update-board-state', (newBoardState) => {
            if (gameResult) return; // Don't update board if game is over
            console.log("Received board state update from server.");
            const newBoard = createBoardFromState(newBoardState);
            newBoard.calculateAllMoves();
            setBoard(newBoard);
            // Also update the main game object if necessary, for example, to get new totalTurns
            setGameState((prevGame: any) => ({ ...prevGame, boardState: newBoardState }));
            
            // Update moves array if the board state includes moves
            if (newBoardState.moves) {
                setMoves(newBoardState.moves);
            }

            // Play sound on opponent moves
            try {
                new Audio('/sounds/move.mp3').play().catch(() => {});
            } catch (error) {
                console.error('Error playing move sound:', error);
            }
        });

        newSocket.on('opponent-left', async ({ leaverId }) => {
            if (playerVerusId) {
                const isOpponent = (currentPlayer === 'white' && gameState.player2.verusId === leaverId) ||
                                 (currentPlayer === 'black' && gameState.player1.verusId === leaverId);
                
                if (isOpponent && !hasUpdatedGameStatus.current) {
                    const winnerData = currentPlayer === 'white' ? gameState.player1 : gameState.player2;
                    setWinner(winnerData);
                    setGameResult('walkover');
                    
                    // Update the game status in the database
                    try {
                        hasUpdatedGameStatus.current = true;
                        const updatedGame = await endGame(gameState.id, currentPlayer === 'white' ? 1 : 2);
                        if (updatedGame) {
                            setGameState(updatedGame); // Update local state with the database result
                            console.log('Game marked as COMPLETED in database (opponent left)');
                        } else {
                            console.error('Failed to update game status in database (opponent left)');
                            hasUpdatedGameStatus.current = false; // Reset on failure
                        }
                    } catch (error) {
                        console.error('Error updating game status (opponent left):', error);
                        hasUpdatedGameStatus.current = false; // Reset on error
                    }
                }
            }
        });

        newSocket.on('opponent-resigned', async () => {
            if (!hasUpdatedGameStatus.current) {
                // Opponent resigned — refetch the game to get updated state
                const updatedGame = await getGame(gameState.id);
                if (updatedGame && updatedGame.status === 'COMPLETED') {
                    hasUpdatedGameStatus.current = true;
                    setGameState(updatedGame);
                    const winnerPlayer = currentPlayer === 'white' ? gameState.player1 : gameState.player2;
                    setWinner(winnerPlayer);
                    setGameResult('resignation');
                }
            }
        });

        newSocket.on('rematch-offered', (payload) => {
            console.log('Received rematch-offered:', payload);
            setIncomingRematch(true);
        });

        newSocket.on('rematch-confirmed', ({ newGameId }) => {
            router.push(`/game/${newGameId}`);
        });

        return () => {
            newSocket.emit('leave-game', { gameId: gameState.id });
            newSocket.disconnect();
        };
    }, [gameState.id, playerVerusId, currentPlayer, router]);

    // Initialize and synchronize board state
    useEffect(() => {
        if (gameState.boardState) {
            const newBoard = createBoardFromState(gameState.boardState);
            newBoard.calculateAllMoves();
            setBoard(newBoard);
            
            // Load moves from board state if available
            if (gameState.boardState.moves) {
                setMoves(gameState.boardState.moves);
            }
            
            if (newBoard.winningTeam) {
                const winnerData = newBoard.winningTeam === TeamType.OUR ? gameState.player1 : gameState.player2;
                setWinner(winnerData);
                setGameResult('checkmate');
                
                // Ensure the game is marked as COMPLETED in the database if it's not already
                if (gameState.status !== 'COMPLETED' && !hasUpdatedGameStatus.current) {
                    const handleExistingGameEnd = async () => {
                        try {
                            hasUpdatedGameStatus.current = true;
                            const updatedGame = await endGame(gameState.id, newBoard.winningTeam === TeamType.OUR ? 1 : 2);
                            if (updatedGame) {
                                setGameState(updatedGame);
                                console.log('Existing completed game marked as COMPLETED in database');
                            }
                        } catch (error) {
                            console.error('Error updating existing completed game:', error);
                            hasUpdatedGameStatus.current = false; // Reset on error
                        }
                    };
                    handleExistingGameEnd();
                }
            }
        }
    }, [gameState.boardState, gameState.player1, gameState.player2, gameState.status, gameState.id]);

    useEffect(() => {
        if (socket && playerVerusId && gameState.id) {
            socket.emit('register-user', playerVerusId);
            socket.emit('joinGameRoom', gameState.id);
            console.log('Registering user and joining game room:', playerVerusId, gameState.id);
        }
    }, [socket, playerVerusId, gameState.id]);

    useEffect(() => {
      if (gameState.mode !== 'showcase' || !currentPlayer) return;

      const checkShowcaseSigning = async () => {
        try {
          const res = await fetch(`/api/game/${gameState.id}/showcase-sign`);
          const data = await res.json();
          if (!data.message) return;

          const playerSide = currentPlayer === 'white' ? 'player1HasSigned' : 'player2HasSigned';
          const otherSide = currentPlayer === 'white' ? 'player2HasSigned' : 'player1HasSigned';
          if (!data[playerSide]) {
            // Current player hasn't signed yet — show signing prompt
            setShowcaseMessage(data.message);
            setShowcaseSigningPhase('open');
          } else if (data.player1HasSigned && data.player2HasSigned) {
            // Both signed — unlock board
            setShowcaseReady(true);
          } else if (data[playerSide] && !data[otherSide]) {
            // Current player signed, waiting for opponent — show prompt in waiting state
            setShowcaseMessage(data.message);
            setShowcaseSigningPhase('open');
            // The ShowcaseSigningPrompt will detect bothSigned=false and show waiting UI
          }
        } catch (e) {
          console.error('[Showcase] Failed to check signing status:', e);
        }
      };

      checkShowcaseSigning();
    }, [gameState.mode, gameState.id, currentPlayer]);

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
            const winnerData = board.winningTeam === TeamType.OUR ? gameState.player1 : gameState.player2;
            if (!winner) setWinner(winnerData);
            if (!gameResult) setGameResult('checkmate');
        }
        return board.winningTeam !== undefined;
    };

    // Handle database update when checkmate is detected
    useEffect(() => {
        const handleGameEnd = async () => {
            if (board?.winningTeam && gameState.status !== 'COMPLETED' && !hasUpdatedGameStatus.current) {
                try {
                    hasUpdatedGameStatus.current = true;
                    const updatedGame = await endGame(gameState.id, board.winningTeam === TeamType.OUR ? 1 : 2);
                    if (updatedGame) {
                        setGameState(updatedGame); // Update local state with the database result
                        console.log('Game marked as COMPLETED in database');
                    } else {
                        console.error('Failed to update game status in database');
                        hasUpdatedGameStatus.current = false; // Reset on failure
                    }
                } catch (error) {
                    console.error('Error ending game:', error);
                    hasUpdatedGameStatus.current = false; // Reset on error
                }
            }
        };

        handleGameEnd();
    }, [board?.winningTeam, gameState.status, gameState.id]);

    async function handlePlayMove(newBoard: Board, move: Move) {
        if (gameResult) return; // Don't allow moves if game is over
        
        // Optimistically update the board for a smoother UI feel, but the server is the source of truth.
        setBoard(newBoard);
        setMoves(prev => [...prev, move]);

        // Play sound on move
        try {
            new Audio('/sounds/move.mp3').play().catch(() => {});
        } catch (error) {
            console.error('Error playing move sound:', error);
        }

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
            moves: [...moves, move],
        };
        
        const updatedGame = await updateGame(gameState.id, newBoardState, {
            move: move,
            player: playerVerusId || '',
        });

        if (updatedGame && updatedGame.boardState) {
            // The server has confirmed the move and returned the new authoritative state.
            // We now update our local state to match the server's state.
            const authoritativeBoard = createBoardFromState(updatedGame.boardState);
            authoritativeBoard.calculateAllMoves();
            setBoard(authoritativeBoard);
            setGameState(updatedGame);

            // Emit the move to the other player
            if (socket) {
                socket.emit('move-made', {
                    gameId: gameState.id,
                    boardState: updatedGame.boardState,
                    signedPackage: (updatedGame as any).signedPackage || null,
                    chainTxid: (updatedGame as any).chainTxid || null,
                });
            }
        } else {
            // If the update failed, we should consider reverting the optimistic update.
            // For now, we'll log an error. A more robust solution could involve
            // refetching the game state or showing an error to the user.
            console.error("Failed to update board state on the server.");
            // Revert to the previous state by refetching
            const pristineGame = await getGame(gameState.id);
            if (pristineGame && pristineGame.boardState) {
                const pristineBoard = createBoardFromState(pristineGame.boardState);
                pristineBoard.calculateAllMoves();
                setBoard(pristineBoard);
                setGameState(pristineGame);
            }
        }
    }

    const handleResign = async () => {
        if (gameResult || !currentPlayer) return;
        const confirmResign = window.confirm('Are you sure you want to resign?');
        if (!confirmResign) return;

        try {
            // The resigning player loses — opponent wins
            const winningPlayer: 1 | 2 = currentPlayer === 'white' ? 2 : 1;
            const updatedGame = await endGame(gameState.id, winningPlayer);
            if (updatedGame) {
                setGameState(updatedGame);
                const opponentPlayer = currentPlayer === 'white' ? gameState.player2 : gameState.player1;
                setWinner(opponentPlayer);
                setGameResult('resignation');

                // Notify opponent via socket that we resigned
                if (socket) {
                    socket.emit('player-resigned', { gameId: gameState.id, resignerId: playerVerusId });
                }
            }
        } catch (error) {
            console.error('Error resigning:', error);
        }
    };

    const handleRematch = () => {
        console.log('Rematch button clicked');
        setRematchOffered(true);
        let opponentId = null;
        if (currentPlayer === 'white') {
            opponentId = gameState.player2.id;
        } else if (currentPlayer === 'black') {
            opponentId = gameState.player1.id;
        }
        console.log('Emitting rematch-offer', { gameId: gameState.id, opponentId, socketConnected: !!socket });
        if (!socket) {
            console.error('Socket not connected!');
            return;
        }
        socket.emit('rematch-offer', { gameId: gameState.id, opponentId });
    };

    const handleAcceptRematch = () => {
        socket?.emit('rematch-accept', { gameId: gameState.id });
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
        if (gameState.mode === 'showcase' && !showcaseReady) return false;
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
    const handlePlayerSelect = (userId: string) => {
        const selectedUser = userId === gameState.player1.id ? gameState.player1 : gameState.player2;
        setPlayerVerusId(selectedUser.id);
        localStorage.setItem('currentUser', selectedUser.id);

        if (userId === gameState.player1.id) {
            setCurrentPlayer('white');
        } else if (userId === gameState.player2.id) {
            setCurrentPlayer('black');
        } else {
            setCurrentPlayer(null);
        }
        // Register user on player select
        if (socket) {
            socket.emit('register-user', userId);
            console.log('Registering user after player select:', userId);
        }
    };
    
    // Auto-detect player from stored user ID
    useEffect(() => {
        if (currentPlayer) return;
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            if (storedUser === gameState.player1.id) {
                handlePlayerSelect(gameState.player1.id);
            } else if (storedUser === gameState.player2.id) {
                handlePlayerSelect(gameState.player2.id);
            }
        }
    }, [gameState.player1.id, gameState.player2.id, currentPlayer]);

    // Fallback: show player selection if auto-detect didn't match
    if (!currentPlayer) {
        return (
            <div className="flex justify-center items-center h-screen bg-background text-foreground">
                <div className="w-full max-w-lg p-8 bg-card rounded-xl shadow-lg border">
                    <h2 className="text-2xl font-bold mb-4 text-center">Who is Playing?</h2>
                    <p className="text-muted-foreground mb-6 text-center">
                        Select your profile to begin the game.
                    </p>
                    <div className="flex justify-around gap-4">
                        {[gameState.player1, gameState.player2].map((player, index) => (
                            <button
                                key={player.id}
                                onClick={() => handlePlayerSelect(player.id)}
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
        return <div className="flex justify-center items-center h-screen">Loading Game {gameState.id}...</div>;
    }
  
    return (
        <>
        {showcaseSigningPhase && gameState.mode === 'showcase' && (
          <ShowcaseSigningPrompt
            gameId={gameState.id}
            player={currentPlayer as 'white' | 'black'}
            playerVerusId={(() => {
              const player = currentPlayer === 'white' ? gameState.player1 : gameState.player2;
              return player?.displayName ? `${player.displayName}@` : player?.verusId || '';
            })()}
            phase={showcaseSigningPhase}
            messageToSign={showcaseMessage}
            onSigned={showcaseOnSigned}
            onBothSigned={showcaseOnBothSigned}
            onLeave={() => {
              if (socket) {
                socket.emit('leave-game', { gameId: gameState.id });
              }
              router.push('/dashboard');
            }}
          />
        )}
        <div className="flex flex-col md:flex-row gap-4 p-4 max-w-7xl mx-auto">
            {gameState.status === 'COMPLETED' && (
                <GameOver
                    game={gameState}
                    winnerName={winner?.displayName || winner?.verusId || 'Unknown'}
                    onRematch={handleRematch}
                    rematchOffered={rematchOffered}
                    currentPlayer={currentPlayer}
                />
            )}
            {incomingRematch && (
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
                {/* <div className="mb-4 p-4 bg-card rounded-lg border shadow-sm text-center">
                    <h2 className="text-xl font-semibold">
                        {game.player1.displayName || game.player1.verusId} (White) vs {game.player2.displayName || game.player2.verusId} (Black)
                    </h2>
                    <p className="text-sm font-medium mt-1">
                        You are: <span className="font-bold">{playerVerusId} ({currentPlayer})</span>
                    </p>
                </div> */}
                <div className="flex flex-row items-center justify-center gap-8 mx-auto">
                    {/* <CapturedPiecesPanel capturedPieces={board.capturedPieces} /> */}
                    <div className="flex flex-col items-center gap-4">
                        {/* Player Avatars */}
                        {/* <div className="flex items-center justify-between w-full gap-8 mb-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={game.player1.avatarUrl || undefined} alt={game.player1.displayName || game.player1.verusId} />
                                    <AvatarFallback>{(game.player1.displayName || game.player1.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-center">
                                    <p className="font-semibold text-sm">{game.player1.displayName || game.player1.verusId}</p>
                                    <p className="text-xs text-muted-foreground">White</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold">VS</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <p className="font-semibold text-sm">{game.player2.displayName || game.player2.verusId}</p>
                                    <p className="text-xs text-muted-foreground">Black</p>
                                </div>
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={game.player2.avatarUrl || undefined} alt={game.player2.displayName || game.player2.verusId} />
                                    <AvatarFallback>{(game.player2.displayName || game.player2.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </div>
                        </div> */}
                        
                        <Chessboard pieces={board.pieces} playMove={playMove} bottomColor={currentPlayer} boardTheme={gameState.boardTheme || 'classic'} logoMode={gameState.logoMode || 'off'} />
                        {!gameResult && currentPlayer && (
                            <Button variant="destructive" size="sm" onClick={handleResign}>
                                Resign
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-row gap-6 ml-auto" style={{ minWidth: '400px', maxWidth: '500px' }}>
                <div style={{ width: '320px' }}>
                    <SubIdStatus gameId={gameState.id} mode={(gameState as any).mode || 'original'} />
                    <MoveHistory 
                        moves={moves} 
                        currentTurn={getCurrentTurn()} 
                        isCheck={isCheck()} 
                        isCheckmate={isCheckmate()} 
                        whitePlayer={gameState.player1}
                        blackPlayer={gameState.player2}
                        blockchainStatus={blockchainStatus}
                    />
                </div>

            </div>
            <PromotionDialog 
                isVisible={showPromotionDialog && !gameResult}
                onPromote={handlePromotion}
                onCancel={cancelPromotion}
                team={pendingPromotion?.piece.team === TeamType.OUR ? TeamType.OUR : TeamType.OPPONENT}
            />
            {/* blockchain status indicators */}
            <GameMoves
                gameId={gameState.id}
                moves={moves.map(m => ({ from: m.from, to: m.to }))}
                playerVerusId={playerVerusId}
                onStatusChange={setBlockchainStatus}
            />
        </div>
        </>
    );
};

export default GameClient; 