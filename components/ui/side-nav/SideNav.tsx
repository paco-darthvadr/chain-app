'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/useSidebar";
import { SidebarItems } from "@/lib/constants";
import { LucideIcon, ChevronsLeft, ChevronsRight } from "lucide-react";

interface SidebarItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

const SideNav = () => {
    const { isOpen, toggle } = useSidebar();
    const pathname = usePathname();

    return (
        <nav className={cn("hidden lg:flex lg:flex-col lg:w-64 lg:h-full lg:border-r lg:border-border", {
            "lg:w-20": !isOpen
        })}>
            <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                    <Link href="/" className="flex items-center space-x-2">
                        {isOpen ? <span className="text-xl font-bold">Chain App</span> : <span className="text-xl font-bold">CA</span>}
                    </Link>
                </div>
                <div className="mt-4">
                    {SidebarItems.map((item: SidebarItem) => (
                        <Link key={item.href} href={item.href}>
                            <Button
                                variant={pathname === item.href ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", {
                                    "px-3": !isOpen
                                })}
                            >
                                <item.icon className="h-5 w-5 mr-3" />
                                {isOpen && <span>{item.label}</span>}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>
            <div className="p-4 border-t border-border">
                <Button onClick={toggle} variant="ghost" className="w-full justify-center">
                    {isOpen ? <ChevronsLeft className="h-6 w-6" /> : <ChevronsRight className="h-6 w-6" />}
                </Button>
            </div>
        </nav>
    );
};

export default SideNav; 