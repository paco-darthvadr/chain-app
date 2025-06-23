'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { getUsers, getGamesForUser, deleteUser } from './actions';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
    id: string;
    verusId: string;
    displayName: string | null;
    avatarUrl: string | null;
}

let socket: Socket;

const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.0.162:3000';
};

function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userGames, setUserGames] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [incomingChallenge, setIncomingChallenge] = useState<{ challengerId: string, challengerName: string } | null>(null);
    const [challengeSent, setChallengeSent] = useState<string | null>(null); // Store opponentId
    const router = useRouter();
    
    const fetchUsersAndGames = useCallback(async (userId: string | null) => {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);

        if (fetchedUsers.length > 0) {
            const savedUser = localStorage.getItem('currentUser');
            let newCurrentId = userId;

            if (!newCurrentId) {
                if (savedUser && fetchedUsers.find((u: User) => u.id === savedUser)) {
                    newCurrentId = savedUser;
                }
            }
            
            if (newCurrentId && fetchedUsers.find((u: User) => u.id === newCurrentId)) {
                setCurrentUserId(newCurrentId);
                localStorage.setItem('currentUser', newCurrentId);
                if (socket) socket.emit('register-user', newCurrentId);
                const games = await getGamesForUser(newCurrentId);
                setUserGames(games);
            } else {
                const remainingUsers = users.filter((u: User) => u.id !== userId);
                const nextUser = remainingUsers.length > 0 ? remainingUsers[0].id : null;
                await fetchUsersAndGames(nextUser);
            }
        } else {
            setUsers([]);
            setCurrentUserId(null);
            localStorage.removeItem('currentUser');
            setUserGames([]);
        }
    }, []);
    
    useEffect(() => {
        console.log('Verifying NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
        
        const socketInitializer = async () => {
            const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://192.168.0.162:3001';
            socket = io(socketURL);

            socket.on('connect', () => {
                console.log('Connected to socket server from UsersPage');
                fetchUsersAndGames(localStorage.getItem('currentUser'));
            });

            socket.on('refresh-game-list', () => {
                console.log('Received refresh-game-list event. Refetching games.');
                const savedUser = localStorage.getItem('currentUser');
                if (savedUser) {
                    fetchUsersAndGames(savedUser);
                }
            });

            socket.on('refresh-user-list', () => {
                console.log('Received refresh-user-list event. Refetching users.');
                const savedUser = localStorage.getItem('currentUser');
                fetchUsersAndGames(savedUser);
            });

            socket.on('new-challenge', ({ challengerId, challengerName }) => {
                const currentUser = localStorage.getItem('currentUser');
                if (challengerId !== currentUser && !incomingChallenge) {
                    setIncomingChallenge({ challengerId, challengerName });
                }
            });

            socket.on('challenge-failed', ({ message }) => {
                alert(message);
                setChallengeSent(null);
            });

            socket.on('game-started', ({ gameId }) => {
                router.push(`/game/${gameId}`);
            });

            socket.on('challenge-denied', ({ declinerName }) => {
                alert(`${declinerName} declined your challenge.`);
                setChallengeSent(null);
            });
        };
        
        socketInitializer();

        const savedUser = localStorage.getItem('currentUser');
        fetchUsersAndGames(savedUser);

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [fetchUsersAndGames]);

    const handleChallenge = async (opponentId: string) => {
        if (!currentUserId) return alert("Please select your user identity first.");
        if (!socket) return alert("Not connected to server. Please wait.");

        const currentUser = users.find(u => u.id === currentUserId);
        if (!currentUser) return alert("Could not find your user data.");
        
        socket.emit('challenge-user', { 
            challengerId: currentUserId,
            challengerName: currentUser.displayName || currentUser.verusId,
            challengeeId: opponentId 
        });
        setChallengeSent(opponentId);
    };

    const handleAcceptChallenge = async () => {
        if (!incomingChallenge || !currentUserId) return;
        setIsLoading(true);
        
        try {
            const res = await fetch(`${getBaseUrl()}/api/game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    whitePlayerId: incomingChallenge.challengerId,
                    blackPlayerId: currentUserId,
                }),
            });
    
            if (res.ok) {
                const newGame = await res.json();
                socket.emit('challenge-accepted', {
                    challengerId: incomingChallenge.challengerId,
                    gameId: newGame.id
                });
                router.push(`/game/${newGame.id}`);
            } else {
                alert('Failed to create game.');
            }
        } catch (error) {
            console.error("Error creating game:", error);
            alert("An error occurred while creating the game.");
        } finally {
            setIncomingChallenge(null);
            setIsLoading(false);
        }
    };
    
    const handleDeclineChallenge = () => {
        if (!incomingChallenge || !currentUserId) return;
        const currentUser = users.find(u => u.id === currentUserId);

        socket.emit('challenge-declined', {
            challengerId: incomingChallenge.challengerId,
            declinerName: currentUser?.displayName || currentUser?.verusId || 'Someone'
        });
        setIncomingChallenge(null);
    };

    const handleDelete = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user? This will also remove all their games.')) {
            setIsDeleting(true);
            const result = await deleteUser(userId);
            if (!result.success) {
                alert(result.error);
            } else {
                if (currentUserId === userId) {
                    localStorage.removeItem('currentUser');
                    setCurrentUserId(null);
                    setUserGames([]);
                }
                fetchUsersAndGames(currentUserId === userId ? null : currentUserId);
            }
            setIsDeleting(false);
        }
    };

    return (
        <DashboardLayout>
            {incomingChallenge && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-card p-8 rounded-lg shadow-xl text-center border">
                        <h2 className="text-2xl font-bold mb-4">{incomingChallenge.challengerName} has challenged you!</h2>
                        <div className="flex justify-center gap-4 mt-6">
                            <Button onClick={handleAcceptChallenge} disabled={isLoading}>
                                {isLoading ? "Accepting..." : "Accept"}
                            </Button>
                            <Button variant="destructive" onClick={handleDeclineChallenge} disabled={isLoading}>
                                Decline
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="container mx-auto p-4">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Users</h1>
                        <Link href="/dev/create-user" passHref>
                            <Button variant="outline">Create Test User</Button>
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Playing as:</span>
                        <Select value={currentUserId || ''} onValueChange={(id) => fetchUsersAndGames(id)}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Select your identity" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((user: User) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.verusId} />
                                                <AvatarFallback>{(user.displayName || user.verusId).substring(0, 1).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span>{user.displayName || user.verusId}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">All Users</h2>
                        {users.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {users.map((user: User) => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.verusId} />
                                                <AvatarFallback>{(user.displayName || user.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{user.displayName || user.verusId}</p>
                                                <p className="text-sm text-muted-foreground font-mono">{user.verusId}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {currentUserId && user.id === currentUserId ? (
                                                <span className="text-sm text-muted-foreground">(You)</span>
                                            ) : null}
                                            <Button 
                                                onClick={() => handleChallenge(user.id)} 
                                                disabled={isLoading || isDeleting || challengeSent === user.id || !!incomingChallenge || user.id === currentUserId}
                                            >
                                                {challengeSent === user.id ? 'Sent' : 'Challenge'}
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)} disabled={isDeleting}>
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 border rounded-lg">
                                <p className="text-muted-foreground">No users found. Create one to get started.</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Your Active Games</h2>
                        {userGames.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {userGames.map(game => {
                                    const opponent = game.whitePlayerId === currentUserId ? game.blackPlayer : game.whitePlayer;
                                    return (
                                        <div key={game.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                            <div className="flex items-center gap-3">
                                                 <Avatar>
                                                    <AvatarImage src={opponent.avatarUrl || undefined} alt={opponent.displayName || opponent.verusId} />
                                                    <AvatarFallback>{(opponent.displayName || opponent.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-semibold">vs {opponent.displayName || opponent.verusId}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        You are {game.whitePlayerId === currentUserId ? 'White' : 'Black'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link href={`/game/${game.id}`} passHref>
                                                <Button variant="outline">Join Game</Button>
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center mt-8">No active games.</p>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default UsersPage; 