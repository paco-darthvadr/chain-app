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
        href: "/game",
        label: "Game",
        icon: Crown,
    },
    {
        href: "/chat",
        label: "Chat",
        icon: MessageSquare,
    },
    {
        href: "/users",
        label: "Users",
        icon: Users,
    },
    {
        href: "/settings",
        label: "Settings",
        icon: Settings,
    },
]; 