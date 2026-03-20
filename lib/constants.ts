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
        href: "/chess/games",
        label: "Chess On-Chain",
        icon: Trophy,
    },
    {
        href: "/checkers/games",
        label: "Checkers On-Chain",
        icon: Trophy,
    },
    {
        href: "/chat",
        label: "Chat",
        icon: MessageSquare,
    },
    {
        href: "/game",
        label: "Chess Offline",
        icon: Crown,
    },
    {
        href: "/settings",
        label: "Settings",
        icon: Settings,
    },
];
