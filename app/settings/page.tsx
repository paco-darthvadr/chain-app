'use client';

import { useState, useEffect, useTransition } from 'react';
import { getUserSettings, updateUserSettings } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const savedUserId = localStorage.getItem('currentUser');
    if (savedUserId) {
      setCurrentUserId(savedUserId);
      getUserSettings(savedUserId).then(userData => {
        if (userData) {
          setUser(userData);
        }
      });
    }
  }, []);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(null);
    if (!currentUserId) {
        setError('No user is currently selected. Please select a user from the Users page.');
        return;
    };

    startTransition(async () => {
      const result = await updateUserSettings(currentUserId, formData);
      if (result.success) {
        setSuccess('Settings updated successfully!');
        // Refetch user data to show updated avatar
        getUserSettings(currentUserId).then(setUser);
      } else {
        setError(result.error || 'An unknown error occurred.');
      }
    });
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
            <h1 className="text-xl">Loading...</h1>
            <p className="text-muted-foreground">If this persists, please select a user from the Users page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <form action={handleSubmit}>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>This information will be displayed to other players.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.avatarUrl} alt={user.displayName || user.verusId} />
                  <AvatarFallback>{(user.displayName || user.verusId).substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className='flex-grow'>
                    <label htmlFor="displayName" className="block text-sm font-medium mb-1">Display Name</label>
                    <Input
                        id="displayName"
                        name="displayName"
                        type="text"
                        defaultValue={user.displayName || ''}
                        placeholder="Enter a fun display name"
                        required
                        minLength={3}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        Your permanent ID is: <span className='font-mono'>{user.verusId}</span>
                    </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-muted/50 py-3 px-6">
                <div className="text-sm">
                    {error && <p className="text-red-500">{error}</p>}
                    {success && <p className="text-green-500">{success}</p>}
                </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
} 