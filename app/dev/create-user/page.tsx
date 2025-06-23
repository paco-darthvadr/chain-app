'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

let socket: Socket;

export default function CreateUserPage() {
    const [verusId, setVerusId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://192.168.0.162:3001';
        socket = io(socketURL);
        return () => {
            if (socket) socket.disconnect();
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verusId) {
            setError('Please enter a username.');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verusId }),
            });

            if (res.ok) {
                if (socket) {
                    socket.emit('new-user-created');
                }
                alert(`User "${verusId}" created successfully!`);
                setVerusId('');
                router.push('/users');
            } else {
                const { error } = await res.json();
                setError(error || 'Failed to create user.');
            }
        } catch (err) {
            setError('An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto flex flex-col items-center justify-center p-8 h-full">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-bold mb-6 text-center">Create a Test User</h1>
                <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg border">
                    <Input
                        type="text"
                        placeholder="Enter a test username (e.g., testuser1)"
                        value={verusId}
                        onChange={(e) => setVerusId(e.target.value)}
                        disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? 'Creating...' : 'Create User'}
                    </Button>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                </form>
            </div>
        </div>
    );
} 