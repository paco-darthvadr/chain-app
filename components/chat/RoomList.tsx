'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Room {
    id: string;
    name: string;
}

interface Props {
    rooms: Room[];
    selectedRoom: Room | null;
    onSelectRoom: (room: Room) => void;
}

const RoomList = ({ rooms, selectedRoom, onSelectRoom }: Props) => {
    return (
        <Card className="w-1/4">
            <CardHeader>
                <CardTitle>Chat Rooms</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {rooms.map((room) => (
                        <li key={room.id}>
                            <button
                                onClick={() => onSelectRoom(room)}
                                className={`w-full text-left p-2 rounded-md transition-colors ${
                                    selectedRoom?.id === room.id
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-blue-200 dark:hover:bg-gray-700 hover:text-accent-foreground'
                                }`}
                            >
                                {room.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};

export default RoomList; 