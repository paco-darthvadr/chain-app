'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Single global socket connection for the dashboard.
 * Stored on window to survive Next.js module boundary splits.
 * All pages use this socket via window events + getGlobalSocket().
 */
export function getGlobalSocket(): Socket | null {
    if (typeof window !== 'undefined') {
        return (window as any).__chessSocket || null;
    }
    return null;
}

function setGlobalSocket(socket: Socket | null) {
    if (typeof window !== 'undefined') {
        (window as any).__chessSocket = socket;
    }
}

export default function SocketRegistration() {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const userId = localStorage.getItem('currentUser');
        if (!userId) return;

        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
        const socket = io(socketURL);
        setGlobalSocket(socket);

        socket.on('connect', () => {
            socket.emit('register-user', userId);
            console.log('[SocketRegistration] Registered user', userId);
        });

        // Relay all socket events as window CustomEvents so any page can listen
        socket.on('new-challenge', ({ challengerId, challengerName }) => {
            window.dispatchEvent(new CustomEvent('socket:new-challenge', {
                detail: { challengerId, challengerName }
            }));
        });

        socket.on('challenge-failed', ({ message }) => {
            window.dispatchEvent(new CustomEvent('socket:challenge-failed', {
                detail: { message }
            }));
        });

        socket.on('game-started', ({ gameId }) => {
            window.location.href = `/game/${gameId}`;
        });

        socket.on('challenge-denied', ({ declinerName }) => {
            window.dispatchEvent(new CustomEvent('socket:challenge-denied', {
                detail: { declinerName }
            }));
        });

        socket.on('refresh-game-list', () => {
            window.dispatchEvent(new CustomEvent('socket:refresh-game-list'));
        });

        socket.on('refresh-user-list', () => {
            window.dispatchEvent(new CustomEvent('socket:refresh-user-list'));
        });

        return () => {
            socket.disconnect();
            setGlobalSocket(null);
        };
    }, []);

    return null;
}
