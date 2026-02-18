'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useRef, useEffect } from 'react';

interface Move {
    piece: string;
    from: string;
    to: string;
    capture?: string;
    turn: 'w' | 'b';
    promotion?: string;
}

interface Player {
    id: string;
    verusId: string;
    displayName: string | null;
    avatarUrl: string | null;
}

interface MoveHistoryProps {
    moves: Move[];
    currentTurn: 'w' | 'b';
    isCheck?: boolean;
    isCheckmate?: boolean;
    whitePlayer?: Player;
    blackPlayer?: Player;
    blockchainStatus?: Record<string, 'storing' | 'processing' | 'stored' | 'failed' | null>;
}

const MoveHistory = ({ moves, currentTurn, isCheck, isCheckmate, whitePlayer, blackPlayer, blockchainStatus }: MoveHistoryProps) => {
    const getBlockchainStatusIcon = (move: Move) => {
        const movekey = `${move.from}-${move.to}`;
        const moveStatus = blockchainStatus?.[movekey];

        switch (moveStatus) {
            case 'storing':
                return <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" title="Storing on blockchain" />;
            case 'processing':
                return <span className="inline-block w-3 h-3 rounded-full bg-orange-400" title="Processing blockchain storage" />;
            case 'stored':
                return <span className="inline-block w-3 h-3 rounded-full bg-green-400" title="Stored on blockchain" />;
            case 'failed':
                return <span className="inline-block w-3 h-3 rounded-full bg-red-400" title="Failed to store on blockchain" />;
            default:
                return null;
        }
    };

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [moves]);

    return (
        <Card className="w-80 bg-card border-border">
            <CardHeader className="border-b border-border">
                <CardTitle className="text-lg text-foreground">Move History</CardTitle>
                <div className="text-sm flex items-center justify-between">
                    <span className={`font-bold px-2 py-1 rounded ${
                        currentTurn === 'w' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-secondary text-secondary-foreground'
                    }`}>
                        {currentTurn === 'w' ? "White's turn" : "Black's turn"}
                    </span>
                    <div className="flex items-center">
                        {isCheckmate && <span className="text-destructive font-bold">Checkmate!</span>}
                        {isCheck && !isCheckmate && <span className="text-yellow-500 font-bold">Check!</span>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="bg-card p-0">
                <div ref={scrollRef} className="h-[600px] overflow-y-auto">
                    {moves.length === 0 ? (
                        <p className="text-gray-400 text-center mt-8">No moves yet</p>
                    ) : (
                        <div className="space-y-2">
                            {moves.map((move, index) => {
                                const isWhiteMove = index % 2 === 0;
                                const player = isWhiteMove ? whitePlayer : blackPlayer;
                                return (
                                    <div
                                        key={index}
                                        className={`p-2 flex items-center gap-2 ${
                                            isWhiteMove ? 'bg-background' : 'bg-secondary'
                                        }`}
                                    >
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={player?.avatarUrl || undefined} alt={player?.displayName || player?.verusId} />
                                            <AvatarFallback className="text-xs">{(player?.displayName || player?.verusId || '?').substring(0, 1).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-foreground">{`${
                                            index + 1
                                        }. ${move.piece} ${move.from}-${move.to}`}</span>
                                        {move.capture && (
                                            <span className="text-yellow-400 ml-1">
                                                (captures {move.capture})
                                            </span>
                                        )}
                                        {move.promotion && (
                                            <span className="text-green-400 ml-1">
                                                (promotes to {move.promotion})
                                            </span>
                                        )}
                                        {getBlockchainStatusIcon(move)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default MoveHistory; 