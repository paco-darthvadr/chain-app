'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, getGamesForUser, deleteUser } from './actions';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { getGlobalSocket } from '@/components/dashboard/SocketRegistration';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BlockchainInfoDialog from '@/components/game/BlockchainInfoDialog';
import ChallengeModal from '@/components/game/ChallengeModal';
interface User {
    id: string;
    verusId: string;
    displayName: string | null;
    avatarUrl: string | null;
}

// Uses global socket from SocketRegistration — no local socket creation

function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userGames, setUserGames] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showBlockchainInfo, setShowBlockchainInfo] = useState(false);
    const [hasShownBlockchainInfo, setHasShownBlockchainInfo] = useState(false);
    const [challengeTarget, setChallengeTarget] = useState<User | null>(null);
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
                const currentUserObj = fetchedUsers.find((u: User) => u.id === newCurrentId);
                if (currentUserObj) {
                    localStorage.setItem('currentUserName', currentUserObj.displayName || currentUserObj.verusId);
                }
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
        // Use the global socket — don't create a local one
        fetchUsersAndGames(localStorage.getItem('currentUser'));

        // Listen for page-specific events via window CustomEvents from SocketRegistration
        const onChallengeFailed = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            alert(detail?.message || 'Challenge failed');
            setChallengeSent(null);
        };
        const onRefreshGames = () => {
            const saved = localStorage.getItem('currentUser');
            if (saved) fetchUsersAndGames(saved);
        };
        const onRefreshUsers = () => {
            const saved = localStorage.getItem('currentUser');
            fetchUsersAndGames(saved);
        };

        window.addEventListener('socket:challenge-failed', onChallengeFailed);
        window.addEventListener('socket:refresh-game-list', onRefreshGames);
        window.addEventListener('socket:refresh-user-list', onRefreshUsers);

        return () => {
            window.removeEventListener('socket:challenge-failed', onChallengeFailed);
            window.removeEventListener('socket:refresh-game-list', onRefreshGames);
            window.removeEventListener('socket:refresh-user-list', onRefreshUsers);
        };
    }, [fetchUsersAndGames]);

    useEffect(() => {
        if (currentUserId && !showBlockchainInfo && !hasShownBlockchainInfo) {
            setShowBlockchainInfo(true);
            setHasShownBlockchainInfo(true);
        }
    }, [currentUserId, showBlockchainInfo, hasShownBlockchainInfo]);

    const handleOpenChallenge = (user: User) => {
        if (!currentUserId) return alert("Please select your user identity first.");
        setChallengeTarget(user);
    };

    const handleConfirmChallenge = ({ mode, boardTheme, logoMode, gameType }: { mode: string; boardTheme: string; logoMode: string; gameType: string }) => {
        const socket = getGlobalSocket();
        if (!currentUserId || !challengeTarget) return;
        if (!socket) return alert("Not connected to server. Please wait and try again.");

        const currentUser = users.find(u => u.id === currentUserId);
        if (!currentUser) return alert("Could not find your user data.");

        socket.emit('challenge-user', {
            challengerId: currentUserId,
            challengerName: currentUser.displayName || currentUser.verusId,
            challengeeId: challengeTarget.id,
            mode,
            boardTheme,
            logoMode,
            gameType,
        });
        setChallengeSent(challengeTarget.id);
        window.dispatchEvent(new CustomEvent('challenge-sent', {
            detail: {
                challengerId: currentUserId,
                challengerName: challengeTarget.displayName || challengeTarget.verusId,
                challengeeId: challengeTarget.id,
                mode,
                boardTheme,
                logoMode,
                gameType,
                challengerStatus: 'available',
                timestamp: Date.now(),
                state: 'sent',
            }
        }));
        setChallengeTarget(null);
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
                                    const opponent = game.player1Id === currentUserId ? game.player2 : game.player1;
                                    const isWhite = game.player1Id === currentUserId;
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
                                            onClick={() => handleOpenChallenge(user)}
                                            disabled={isLoading || isDeleting || challengeSent === user.id}
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
            {challengeTarget && (
                <ChallengeModal
                    targetUser={challengeTarget}
                    onConfirm={handleConfirmChallenge}
                    onClose={() => setChallengeTarget(null)}
                />
            )}
        </DashboardLayout>
    );
}

export default UsersPage; 