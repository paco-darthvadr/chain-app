'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Invisible component that registers the current user on the Socket.IO server.
 * Mounted in the dashboard layout so the user is always "online" for challenges
 * regardless of which page they're on.
 */
export default function SocketRegistration() {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const userId = localStorage.getItem('currentUser');
        if (!userId) return;

        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
        const socket = io(socketURL);
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('register-user', userId);
            console.log('[SocketRegistration] Registered user', userId);
        });

        // Handle incoming challenges from any page
        socket.on('new-challenge', ({ challengerId, challengerName }) => {
            // Store in sessionStorage so the users page can pick it up
            sessionStorage.setItem('pendingChallenge', JSON.stringify({ challengerId, challengerName }));
            // Dispatch a custom event so any listening component can react
            window.dispatchEvent(new CustomEvent('incoming-challenge', {
                detail: { challengerId, challengerName }
            }));
        });

        socket.on('game-started', ({ gameId }) => {
            window.location.href = `/game/${gameId}`;
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    return null;
}
