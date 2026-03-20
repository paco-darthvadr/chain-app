'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SidebarItems } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ThemeSwitcher } from "./ThemeSwitcher";
import ChallengeInbox from '@/components/dashboard/ChallengeInbox';

const Navbar = () => {
    const pathname = usePathname();
    const router = useRouter();

    const getPageTitle = () => {
        const item = SidebarItems.find(item => item.href === pathname);
        return item ? item.label : '';
    };

    return (
        <header className="flex items-center justify-between p-4 bg-background border-b border-border">
            <h1 className="text-xl font-bold">{getPageTitle()}</h1>
            <div className="flex items-center space-x-2">
                <ChallengeInbox />
                <ThemeSwitcher />
                <Button variant="ghost" size="icon" onClick={() => router.push('/login')}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
        </header>
    );
};

export default Navbar;
