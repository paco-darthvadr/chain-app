'use client';

import { useState, useCallback, Suspense } from 'react';
import { getGameConfig, isValidGameType } from '@/app/games/registry';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useParams } from 'next/navigation';

export default function OfflinePage() {
    const params = useParams();
    const gameType = params.gameType as string;

    if (!isValidGameType(gameType)) {
        return <DashboardLayout><p>Unknown game type.</p></DashboardLayout>;
    }

    const config = getGameConfig(gameType);
    const BoardComponent = config.BoardComponent;
    const [boardState, setBoardState] = useState(() => config.createInitialState());
    const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);

    const handleMove = useCallback((move: string, newBoardState: any) => {
        setBoardState(newBoardState);
        setCurrentPlayer(prev => prev === 1 ? 2 : 1);
    }, []);

    return (
        <DashboardLayout>
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">{config.displayName} — Offline</h1>
                <Suspense fallback={<div>Loading...</div>}>
                    <BoardComponent
                        boardState={boardState}
                        currentPlayer={currentPlayer}
                        onMove={handleMove}
                        boardTheme="classic"
                        logoMode="off"
                    />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
