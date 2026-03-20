import SideNav from "@/components/ui/side-nav/SideNav";
import Navbar from "@/components/ui/Navbar";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <>
            <SideNav />
            <main className="flex-1 flex flex-col">
                <Navbar />
                <div className="p-8 flex-1">{children}</div>
            </main>
        </>
    );
}
