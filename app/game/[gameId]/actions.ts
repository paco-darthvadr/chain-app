// This file is now a client-side utility for API calls, so 'use server' is not needed.

const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.0.162:3000';
};

export async function getGame(gameId: string) {
    try {
        const res = await fetch(`${getBaseUrl()}/api/game/${gameId}`);
        if (!res.ok) {
            throw new Error('Failed to fetch game');
        }
        return await res.json();
    } catch (error) {
        console.error('Error fetching game:', error);
        return null;
    }
}

export async function updateBoardState(gameId: string, boardState: any) {
    try {
        const res = await fetch(`${getBaseUrl()}/api/game/${gameId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ boardState }),
        });
        if (!res.ok) {
            throw new Error('Failed to update board state');
        }
        return await res.json();
    } catch (error) {
        console.error('Error updating board state:', error);
        return null;
    }
}

export async function declareWinner(gameId: string, winnerId: string) {
    try {
        const res = await fetch(`${getBaseUrl()}/api/game/${gameId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: 'COMPLETED',
                winner: winnerId,
            }),
        });
        if (!res.ok) {
            throw new Error('Failed to declare winner');
        }
        return await res.json();
    } catch (error) {
        console.error('Error declaring winner:', error);
        return null;
    }
} 