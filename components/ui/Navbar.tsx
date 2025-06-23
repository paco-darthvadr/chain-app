'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SidebarItems } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { ThemeSwitcher } from "./ThemeSwitcher";

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
                <ThemeSwitcher />
                <Button variant="ghost" size="icon" onClick={() => router.push('/login')}>
                    <Menu className="h-6 w-6" />
                </Button>
            </div>
        </header>
    );
};

export default Navbar; 