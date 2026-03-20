'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Challenge {
  challengerId: string;
  challengerName: string;
  challengeeId?: string;
  mode: string;
  boardTheme: string;
  logoMode: string;
  gameType?: string;
  challengerStatus: 'available' | 'in-game' | 'offline';
  timestamp: number;
  state: 'incoming' | 'sent' | 'accepted-waiting' | 'opponent-ready';
  acceptorName?: string;
}

interface ChallengeContextType {
  challenges: Challenge[];
  addChallenge: (challenge: Challenge) => void;
  removeChallenge: (challengerId: string) => void;
  updateChallengerStatus: (userId: string, status: 'available' | 'in-game' | 'offline') => void;
  markAcceptedWaiting: (challengerId: string) => void;
  markOpponentReady: (challengerId: string, acceptorName: string) => void;
  clearAll: () => void;
}

const ChallengeContext = createContext<ChallengeContextType | null>(null);

export function useChallenges() {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw new Error('useChallenges must be inside ChallengeProvider');
  return ctx;
}

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const addChallenge = useCallback((challenge: Challenge) => {
    setChallenges(prev => {
      if (prev.some(c => c.challengerId === challenge.challengerId && c.state === challenge.state)) {
        return prev;
      }
      return [...prev, challenge];
    });
  }, []);

  const removeChallenge = useCallback((challengerId: string) => {
    setChallenges(prev => prev.filter(c => c.challengerId !== challengerId));
  }, []);

  const updateChallengerStatus = useCallback((userId: string, status: 'available' | 'in-game' | 'offline') => {
    setChallenges(prev => prev.map(c => {
      if (c.challengerId === userId) return { ...c, challengerStatus: status };
      if (c.challengeeId === userId) return { ...c, challengerStatus: status };
      return c;
    }));
  }, []);

  const markAcceptedWaiting = useCallback((challengerId: string) => {
    setChallenges(prev => prev.map(c =>
      c.challengerId === challengerId && c.state === 'incoming'
        ? { ...c, state: 'accepted-waiting' as const }
        : c
    ));
  }, []);

  const markOpponentReady = useCallback((challengerId: string, acceptorName: string) => {
    setChallenges(prev => prev.map(c =>
      c.challengerId === challengerId || c.challengeeId === challengerId
        ? { ...c, state: 'opponent-ready' as const, acceptorName }
        : c
    ));
  }, []);

  const clearAll = useCallback(() => setChallenges([]), []);

  return (
    <ChallengeContext.Provider value={{
      challenges, addChallenge, removeChallenge,
      updateChallengerStatus, markAcceptedWaiting, markOpponentReady, clearAll
    }}>
      {children}
    </ChallengeContext.Provider>
  );
}
