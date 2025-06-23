'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import RoomList from '@/components/chat/RoomList';
import ChatRoom, { Message } from '@/components/chat/ChatRoom';
import UserPanel, { User } from '@/components/chat/UserPanel';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { getUsersByIds } from './actions';
import { getUserSettings } from '../settings/actions';

interface Room {
    id: string;
    name: string;
}

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://192.168.0.162:3001';

const ChatPage = () => {
    const [rooms] = useState<Room[]>([
        { id: 'General', name: 'General' },
        { id: 'Strategy', name: 'Chess Strategy' },
        { id: 'Off-Topic', name: 'Off-Topic' },
    ]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [usersInRoom, setUsersInRoom] = useState<User[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        const userId = localStorage.getItem('currentUser');
        if (userId) {
            getUserSettings(userId).then(setCurrentUser);
        }
    }, []);

    const fetchRoomUsers = useCallback(async (userIds: string[]) => {
        const users = await getUsersByIds(userIds);
        setUsersInRoom(users);
    }, []);
    
    useEffect(() => {
        if (!currentUser || !selectedRoom) return;

        const newSocket = io(socketUrl);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to socket server');
            newSocket.emit('joinRoom', { roomId: selectedRoom.id, userId: currentUser.id });
        });

        newSocket.on('updateUserList', ({ users }: { users: string[] }) => {
            fetchRoomUsers(users);
        });
        
        newSocket.on('userJoined', ({ userId }) => {
            if (userId !== currentUser.id) {
                getUsersByIds([userId]).then(users => {
                    if (users.length > 0) {
                        const joinedUser = users[0];
                        const eventMessage: Message = {
                            id: Date.now(),
                            text: `${joinedUser.displayName || joinedUser.verusId} has joined the chat.`,
                            type: 'event',
                        };
                        setMessages(prev => [...prev, eventMessage]);
                    }
                });
            }
        });

        newSocket.on('userLeft', ({ userId }) => {
            const leftUser = usersInRoom.find(u => u.id === userId);
            const userName = leftUser?.displayName || leftUser?.verusId || 'A user';
            const eventMessage: Message = {
                id: Date.now(),
                text: `${userName} has left the chat.`,
                type: 'event',
            };
            setMessages(prev => [...prev, eventMessage]);
        });
        
        newSocket.on('newMessage', (message: Message) => {
            setMessages((prevMessages) => [...prevMessages, message]);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [selectedRoom, currentUser, fetchRoomUsers]);

    const handleSelectRoom = (room: Room) => {
        setMessages([]);
        setUsersInRoom([]);
        setSelectedRoom(room);
        if (socket && currentUser) {
            socket.emit('joinRoom', { roomId: room.id, userId: currentUser.id });
        }
    };

    const handleSendMessage = (text: string) => {
        if (socket && selectedRoom && currentUser) {
            const newMessage: Message = {
                id: Date.now(),
                text,
                user: currentUser,
                type: 'message',
            };
            socket.emit('sendMessage', { roomId: selectedRoom.id, message: newMessage });
        }
    };

    return (
        <DashboardLayout>
            <div className="flex h-full gap-4">
                <RoomList
                    rooms={rooms}
                    selectedRoom={selectedRoom}
                    onSelectRoom={handleSelectRoom}
                />
                {selectedRoom && currentUser ? (
                    <>
                        <ChatRoom
                            room={selectedRoom}
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            currentUserId={currentUser.id}
                        />
                        <UserPanel 
                            usersInRoom={usersInRoom}
                        />
                    </>
                ) : (
                    <div className="flex flex-grow items-center justify-center">
                        <p className="text-gray-500">
                            {currentUser ? 'Select a room to start chatting' : 'Please select a user from the Users page to join the chat.'}
                        </p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default ChatPage; 