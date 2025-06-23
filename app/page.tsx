'use client';

import InfoCard from '@/components/dashboard/InfoCard';
import ActivityChart from '@/components/dashboard/ActivityChart';
import { Crown, MessageCircle, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function Home() {
  return (
    <DashboardLayout>
      <div className="flex-col md:flex">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard 
              title="Active Users"
              value="12"
              icon={Users}
              description="+2 from last month"
            />
            <InfoCard 
              title="Active Games"
              value="4"
              icon={Crown}
              description="+1 from last month"
            />
            <InfoCard 
              title="Active Chats"
              value="3"
              icon={MessageCircle}
              description="+1 from last month"
            />
            <InfoCard 
              title="New Users"
              value="5"
              icon={Users}
              description="+5 from last month"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <ActivityChart />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
