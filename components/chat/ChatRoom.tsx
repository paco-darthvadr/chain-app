'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from './UserPanel';

export interface Message {
    id: number;
    text: string;
    type: 'message' | 'event';
    user?: User;
}

interface Room {
    id: string;
    name: string;
}

interface Props {
    room: Room;
    messages: Message[];
    onSendMessage: (text: string) => void;
    currentUserId: string;
}

const ChatRoom = ({ room, messages, onSendMessage, currentUserId }: Props) => {
    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = () => {
        if (newMessage.trim()) {
            onSendMessage(newMessage);
            setNewMessage('');
        }
    };

    return (
        <Card className="flex flex-col flex-grow">
            <CardHeader>
                <CardTitle>{room.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((message) => {
                        if (message.type === 'event') {
                            return (
                                <div key={message.id} className="text-center text-sm text-gray-500 my-2">
                                    {message.text}
                                </div>
                            );
                        }

                        const senderType = message.user?.id === currentUserId ? 'user' : 'other';

                        return (
                            <div
                                key={message.id}
                                className={`flex items-end gap-2 ${
                                    senderType === 'user' ? 'justify-end' : ''
                                }`}
                            >
                                {senderType === 'other' && message.user && (
                                    <Avatar>
                                        <AvatarImage src={message.user.avatarUrl || undefined} />
                                        <AvatarFallback>{(message.user.displayName || message.user.verusId).substring(0,2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div
                                    className={`rounded-lg px-4 py-2 max-w-xs ${
                                        senderType === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-50'
                                    }`}
                                >
                                    <p className="font-bold text-xs mb-1">{senderType === 'other' ? message.user?.displayName : ''}</p>
                                    {message.text}
                                </div>
                                {senderType === 'user' && message.user && (
                                    <Avatar>
                                        <AvatarImage src={message.user.avatarUrl || undefined} />
                                        <AvatarFallback>ME</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            <div className="p-4 border-t">
                <div className="flex items-center gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage}>Send</Button>
                </div>
            </div>
        </Card>
    );
};

export default ChatRoom; 