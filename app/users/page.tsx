'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { getUsers, getGamesForUser, deleteUser } from './actions';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

let socket: Socket | null = null;
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BlockchainInfoDialog from '@/components/chessboard/BlockchainInfoDialog';

interface User {
    id: string;
    verusId: string;
    displayName: string | null;
    avatarUrl: string | null;
}

// Uses global socket from SocketRegistration — no local socket creation

const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_APP_URL;
};

function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userGames, setUserGames] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showBlockchainInfo, setShowBlockchainInfo] = useState(false);
    const [hasShownBlockchainInfo, setHasShownBlockchainInfo] = useState(false);
    const [incomingChallenge, setIncomingChallenge] = useState<{ challengerId: string, challengerName: string } | null>(null);
    const [challengeSent, setChallengeSent] = useState<string | null>(null); // Store opponentId
    const router = useRouter();
    
    const isFetchingRef = useRef(false);

    const fetchUsersAndGames = useCallback(async (userId: string | null) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);

        if (fetchedUsers.length > 0) {
            const savedUser = localStorage.getItem('currentUser');
            let newCurrentId = userId;

            if (!newCurrentId && savedUser && fetchedUsers.find((u: User) => u.id === savedUser)) {
                newCurrentId = savedUser;
            }
            
            if (newCurrentId && fetchedUsers.find((u: User) => u.id === newCurrentId)) {
                setCurrentUserId(newCurrentId);
                localStorage.setItem('currentUser', newCurrentId);
                if (socket) socket.emit('register-user', newCurrentId);
                const games = await getGamesForUser(newCurrentId);
                setUserGames(games);
            } else {
                setCurrentUserId(null);
                localStorage.removeItem('currentUser');
                setUserGames([]);
            }
        } else {
            setUsers([]);
            setCurrentUserId(null);
            localStorage.removeItem('currentUser');
            setUserGames([]);
        }

        isFetchingRef.current = false;
    }, []);
    
    useEffect(() => {
        const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
        socket = io(socketURL);

        socket.on('connect', () => {
            const userId = localStorage.getItem('currentUser');
            if (userId) {
                socket!.emit('register-user', userId);
                console.log('[UsersPage] Registered user', userId);
            }
            fetchUsersAndGames(localStorage.getItem('currentUser'));
        });

        socket.on('new-challenge', ({ challengerId, challengerName }) => {
            const currentUser = localStorage.getItem('currentUser');
            if (challengerId !== currentUser) {
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

        socket.on('refresh-game-list', () => {
            const saved = localStorage.getItem('currentUser');
            if (saved) fetchUsersAndGames(saved);
        });

        socket.on('refresh-user-list', () => {
            const saved = localStorage.getItem('currentUser');
            fetchUsersAndGames(saved);
        });

        return () => {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        };
    }, [fetchUsersAndGames]);

    useEffect(() => {
        if (currentUserId && !showBlockchainInfo && !hasShownBlockchainInfo) {
            setShowBlockchainInfo(true);
            setHasShownBlockchainInfo(true);
        }
    }, [currentUserId, showBlockchainInfo, hasShownBlockchainInfo]);

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
                if (socket) {
                    socket.emit('challenge-accepted', {
                        challengerId: incomingChallenge.challengerId,
                        gameId: newGame.id
                    });
                }
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
            {showBlockchainInfo && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                    onClick={() => setShowBlockchainInfo(false)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <BlockchainInfoDialog
                            isVisible={showBlockchainInfo}
                            onClose={() => setShowBlockchainInfo(false)}
                            playerName={
                                (() => {
                                    const currentUser = users.find(u => u.id === currentUserId);
                                    return currentUser?.displayName || currentUser?.verusId;
                                })()
                            }
                        />
                    </div>
                </div>
            )}
            <div className="container mx-auto p-4">
                {/* Top: Current User VerusID Card */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex-1">
                        {(() => {
                            const currentUser = users.find(u => u.id === currentUserId);
                            if (!currentUser) return null;
                            return (
                                <div className="bg-card border rounded-lg p-6 flex items-center gap-4 max-w-xl">
                                    <Avatar className="h-14 w-14">
                                        <AvatarImage src={currentUser.avatarUrl || undefined} alt={currentUser.displayName || currentUser.verusId} />
                                        <AvatarFallback>{(currentUser.displayName || currentUser.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">{currentUser.displayName || currentUser.verusId}</span>
                                            <span className="text-green-600 text-xs font-semibold">(You)</span>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground break-all">{currentUser.verusId}</div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
                {/* Main Content: Games Played and Challenge a User */}
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Games Played */}
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Games Played</h2>
                        {userGames.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {userGames.map(game => {
                                    const opponent = game.whitePlayerId === currentUserId ? game.blackPlayer : game.whitePlayer;
                                    const isWhite = game.whitePlayerId === currentUserId;
                                    return (
                                        <div key={game.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={opponent.avatarUrl || undefined} alt={opponent.displayName || opponent.verusId} />
                                                    <AvatarFallback>{(opponent.displayName || opponent.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-semibold">{opponent.displayName || opponent.verusId}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        You are {isWhite ? 'White' : 'Black'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link href={`/game/${game.id}`} passHref>
                                                <Button variant="outline">View</Button>
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 border rounded-lg">
                                <p className="text-muted-foreground">No games played yet.</p>
                            </div>
                        )}
                    </div>
                    {/* Challenge a User */}
                    <div className="w-full md:w-1/3">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Challenge a User</h2>
                        <div className="flex flex-col gap-4">
                            {users.filter(u => u.id !== currentUserId).length > 0 ? (
                                users.filter(u => u.id !== currentUserId).map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.verusId} />
                                                <AvatarFallback>{(user.displayName || user.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{user.displayName || user.verusId}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{user.verusId}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => handleChallenge(user.id)} 
                                            disabled={isLoading || isDeleting || challengeSent === user.id || !!incomingChallenge}
                                        >
                                            {challengeSent === user.id ? 'Sent' : 'Challenge'}
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 border rounded-lg">
                                    <p className="text-muted-foreground">No other users to challenge.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default UsersPage; 