import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    Crown,
    Trophy,
} from "lucide-react";

export const SidebarItems = [
    {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
    },
    {
        href: "/users",
        label: "Challenge Players",
        icon: Users,
    },
    {
        href: "/games",
        label: "On-Chain Games",
        icon: Trophy,
    },
    {
        href: "/chat",
        label: "Chat",
        icon: MessageSquare,
    },
    {
        href: "/game",
        label: "Offline Game",
        icon: Crown,
    },
    {
        href: "/settings",
        label: "Settings",
        icon: Settings,
    },
]; 