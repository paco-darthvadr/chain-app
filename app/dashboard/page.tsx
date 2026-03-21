'use client';

import InfoCard from '@/components/dashboard/InfoCard';
import ActivityChart from '@/components/dashboard/ActivityChart';
import Leaderboard from '../../components/dashboard/Leaderboard';
import { Clock, Crown, MessageCircle, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useEffect, useState } from 'react';
import DashboardBackground from '@/components/dashboard/DashboardBackgrond';

// LiveClock component
function LiveClock() {
  const [time, setTime] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!mounted) return;
    const update = () => setTime(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <span className="font-mono text-2xl text-blue-500">
      {time}
    </span>
  );
}

export default function Home() {

  // Set currentUser in local Storage if the userId query param is present (for testing purposes)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      if (userId) {
        localStorage.setItem('currentUser', userId);
      }
    }
  }, []);

  const [userCount, setUserCount] = useState<number>(0);
  const [gameCount, setGameCount] = useState<number>(0);
  const [onChainCount, setOnChainCount] = useState<number>(0);
  const [inProgressCount, setInProgressCount] = useState<number>(0);

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const res = await fetch(`${baseUrl}/api/users`);
        if (res.ok) {
          const users = await res.json();
          setUserCount(users.length);
        }
      } catch (error) {
        setUserCount(0);
      }
    };
    const fetchGameCount = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const res = await fetch(`${baseUrl}/api/games`);
        if (res.ok) {
          const games = await res.json();
          setGameCount(games.length);
          setOnChainCount(games.filter((g: any) => g.blockchainTxId && g.blockchainTxId !== 'PROCESSING').length);
          setInProgressCount(games.filter((g: any) => g.status === 'IN_PROGRESS').length);
        }
      } catch (error) {
        setGameCount(0);
        setOnChainCount(0);
        setInProgressCount(0);
      }
    };
    fetchUserCount();
    fetchGameCount();
  }, []);

  return (
    <DashboardLayout>
      <div style={{position: 'relative'}}>
        {/* <DashboardAuroraBackground /> */}
        <DashboardBackground />
        <div className="flex-col md:flex">
          <div className="flex-1 space-y-4 p-8 pt-6 dashboard-content">
            <div className="flex justify-center items-center space-y-2">
              <h1 className="text-6xl font-extrabold tracking-tight text-center three-d-title">Verus Game Arena</h1>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <InfoCard 
                title="Player Count"
                value={userCount.toString()}
                icon={Users}
                description="Total registered players"
              />
              <InfoCard 
                title="Games Played"
                value={gameCount.toString()}
                icon={Crown}
                description={`On-chain: ${onChainCount}`}
              />
              <InfoCard 
                title="Games In Progress"
                value={inProgressCount.toString()}
                icon={Crown}
                description="Currently being played"
              />
              <InfoCard 
                title="Current Time"
                value={<LiveClock />}
                icon={Clock}
                description="Current time"
              />
            </div>
            <div className="flex justify-center w-full mt-8">
              <div className="md:w-2/3 lg:w-1/2">
                <Leaderboard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}