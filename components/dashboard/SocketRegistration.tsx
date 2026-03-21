'use client';

import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChallenges } from './ChallengeContext';

export function getGlobalSocket(): Socket | null {
    if (typeof window !== 'undefined') {
        return (window as any).__gameSocket || null;
    }
    return null;
}

function setGlobalSocket(socket: Socket | null) {
    if (typeof window !== 'undefined') {
        (window as any).__gameSocket = socket;
    }
}

export default function SocketRegistration() {
    const { addChallenge, removeChallenge, updateChallengerStatus, markOpponentReady } = useChallenges();

    useEffect(() => {
        const userId = localStorage.getItem('currentUser');
        if (!userId) return;

        // If a socket already exists and is connected, don't create another
        const existing = getGlobalSocket();
        if (existing?.connected) return;

        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
        const socket = io(socketURL);
        setGlobalSocket(socket);

        socket.on('connect', () => {
            socket.emit('register-user', userId);
            console.log('[SocketRegistration] Registered user', userId);
        });

        socket.on('new-challenge', ({ challengerId, challengerName, mode, boardTheme, logoMode, challengerStatus, gameType }) => {
            addChallenge({
                challengerId,
                challengerName,
                mode: mode || 'normal',
                boardTheme: boardTheme || 'classic',
                logoMode: logoMode || 'off',
                gameType: gameType || 'chess',
                challengerStatus: challengerStatus ?? 'available',
                timestamp: Date.now(),
                state: 'incoming',
            });
            window.dispatchEvent(new CustomEvent('socket:new-challenge', {
                detail: { challengerId, challengerName, mode }
            }));
        });

        socket.on('challenge-cancelled', ({ challengerId }) => {
            removeChallenge(challengerId);
        });

        socket.on('challenge-failed', ({ message }) => {
            window.dispatchEvent(new CustomEvent('socket:challenge-failed', {
                detail: { message }
            }));
        });

        socket.on('game-started', ({ gameId }) => {
            window.dispatchEvent(new CustomEvent('socket:game-started', {
                detail: { gameId }
            }));
            window.location.href = `/game/${gameId}`;
        });

        socket.on('challenge-denied', ({ challengerId, declinerName }) => {
            if (challengerId) removeChallenge(challengerId);
            window.dispatchEvent(new CustomEvent('socket:challenge-denied', {
                detail: { declinerName }
            }));
        });

        socket.on('user-status-changed', ({ userId: changedUserId, status }) => {
            updateChallengerStatus(changedUserId, status);
        });

        socket.on('ready-to-play', ({ acceptorId, acceptorName }) => {
            markOpponentReady(acceptorId, acceptorName);
        });

        socket.on('refresh-game-list', () => {
            window.dispatchEvent(new CustomEvent('socket:refresh-game-list'));
        });

        socket.on('refresh-user-list', () => {
            window.dispatchEvent(new CustomEvent('socket:refresh-user-list'));
        });

        // Listen for sent challenges from the users page
        const handleChallengeSent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) addChallenge(detail);
        };
        window.addEventListener('challenge-sent', handleChallengeSent);

        return () => {
            socket.disconnect();
            setGlobalSocket(null);
            window.removeEventListener('challenge-sent', handleChallengeSent);
        };
    }, [addChallenge, removeChallenge, updateChallengerStatus, markOpponentReady]);

    return null;
}
