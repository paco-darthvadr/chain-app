import SideNav from "@/components/ui/side-nav/SideNav";
import Navbar from "@/components/ui/Navbar";
import SocketRegistration from "@/components/dashboard/SocketRegistration";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <>
            <SocketRegistration />
            <SideNav />
            <main className="flex-1 flex flex-col">
                <Navbar />
                <div className="p-8 flex-1">{children}</div>
            </main>
        </>
    );
} 