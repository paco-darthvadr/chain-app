import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    Crown,
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