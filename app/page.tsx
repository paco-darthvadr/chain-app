import DashboardCard from "@/components/ui/dashboard/DashboardCard";
import { Crown, MessageCircle, Users } from "lucide-react";

export default function Home() {
  return (
    <>
    <div className="flex flex-col md:flex-row gap-10 mb-5 mt-10">
      <DashboardCard title="Chat" count={2} icon={<MessageCircle className="text-slate-500" size={70}/>}/>
      <DashboardCard title="Game" count={2} icon={<Crown className="text-slate-500" size={70}/>}/>
      <DashboardCard title="Users" count={2} icon={<Users className="text-slate-500" size={70}/>}/>
    </div>
    </>
  );
}
