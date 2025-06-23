'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface User {
  id: string;
  verusId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Props {
    usersInRoom: User[];
}

const UserPanel = ({ usersInRoom }: Props) => {
    return (
        <Card className="w-64 flex-shrink-0">
            <CardHeader>
                <CardTitle>Users in Room</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {usersInRoom.map(user => (
                        <li key={user.id} className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.verusId} />
                                <AvatarFallback>{(user.displayName || user.verusId).substring(0, 1).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{user.displayName || user.verusId}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};

export default UserPanel; 