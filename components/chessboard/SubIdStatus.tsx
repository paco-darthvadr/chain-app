'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SubIdStatusProps {
    gameId: string;
    mode: string;
}

const SubIdStatus: React.FC<SubIdStatusProps> = ({ gameId, mode }) => {
    const [status, setStatus] = useState<'none' | 'pending' | 'online' | 'error'>('none');
    const [fullName, setFullName] = useState('');
    const [message, setMessage] = useState('');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (mode !== 'normal' && mode !== 'showcase') return;

        const checkStatus = async () => {
            try {
                const res = await fetch(`/api/game/${gameId}/subid-status`);
                if (!res.ok) return;
                const data = await res.json();

                setStatus(data.status);
                if (data.fullName) setFullName(data.fullName);
                if (data.message) setMessage(data.message);

                // Stop polling once online
                if (data.status === 'online' && intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            } catch (e) {
                // Non-fatal
            }
        };

        checkStatus();
        intervalRef.current = setInterval(checkStatus, 15000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [gameId, mode]);

    if ((mode !== 'normal' && mode !== 'showcase') || status === 'none') return null;

    const statusConfig = {
        pending: {
            bg: 'bg-yellow-500/10 border-yellow-500/30',
            dot: 'bg-yellow-500',
            text: 'text-yellow-600',
            label: fullName ? `${fullName} registering...` : 'SubID registering...',
        },
        online: {
            bg: 'bg-green-500/10 border-green-500/30',
            dot: 'bg-green-500',
            text: 'text-green-600',
            label: fullName ? `${fullName} is online` : 'SubID online',
        },
        error: {
            bg: 'bg-red-500/10 border-red-500/30',
            dot: 'bg-red-500',
            text: 'text-red-600',
            label: message || 'SubID registration failed',
        },
        none: {
            bg: '', dot: '', text: '', label: '',
        },
    };

    const config = statusConfig[status];

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs ${config.bg}`}>
            <span className={`w-2 h-2 rounded-full ${config.dot} ${status === 'pending' ? 'animate-pulse' : ''}`} />
            <span className={`font-medium ${config.text}`}>{config.label}</span>
        </div>
    );
};

export default SubIdStatus;
