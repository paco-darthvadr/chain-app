'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Move {
    piece: string;
    from: string;
    to: string;
    capture?: string;
    turn: 'w' | 'b';
    promotion?: string;
}

interface MoveHistoryProps {
    moves: Move[];
    currentTurn: 'w' | 'b';
    isCheck?: boolean;
    isCheckmate?: boolean;
}

const MoveHistory = ({ moves, currentTurn, isCheck, isCheckmate }: MoveHistoryProps) => {
    const formatPosition = (x: number, y: number) => {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        return `${files[x]}${ranks[y]}`;
    };

    return (
        <Card className="w-80 h-96 bg-card border-border">
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
                <div className="h-full overflow-y-auto">
                    {moves.length === 0 ? (
                        <p className="text-gray-400 text-center mt-8">No moves yet</p>
                    ) : (
                        <div className="space-y-2">
                            {moves.map((move, index) => {
                                const isWhiteMove = index % 2 === 0;
                                return (
                                    <div
                                        key={index}
                                        className={`p-2 ${
                                            isWhiteMove ? 'bg-background' : 'bg-secondary'
                                        }`}
                                    >
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