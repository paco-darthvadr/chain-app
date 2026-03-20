'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { BOARD_THEMES, BoardTheme, LogoMode } from '@/app/utils/board-themes';

interface ChallengeModalProps {
  targetUser: { id: string; displayName: string | null; verusId: string };
  onConfirm: (settings: { mode: string; boardTheme: string; logoMode: LogoMode }) => void;
  onClose: () => void;
}

function MiniBoard({ theme, logoMode }: { theme: BoardTheme; logoMode: LogoMode }) {
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      squares.push(
        <div
          key={`${r}-${c}`}
          style={{
            backgroundColor: (r + c) % 2 === 0 ? theme.lightSquare : theme.darkSquare,
          }}
        />
      );
    }
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(8, 1fr)',
      aspectRatio: '1',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '2px solid transparent',
      position: 'relative',
    }}>
      {squares}
      {logoMode !== 'off' && (
        <img
          src="/img/verus-icon-white.svg"
          alt=""
          style={{
            position: 'absolute',
            top: '25%',
            left: '25%',
            width: '50%',
            height: '50%',
            opacity: logoMode === 'faded' ? 0.1 : 0.4,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.3))',
          }}
        />
      )}
    </div>
  );
}

export default function ChallengeModal({ targetUser, onConfirm, onClose }: ChallengeModalProps) {
  const [mode, setMode] = useState<string>('normal');
  const [selectedTheme, setSelectedTheme] = useState<string>('classic');
  const [logoMode, setLogoMode] = useState<LogoMode>('off');

  const handleConfirm = () => {
    onConfirm({ mode, boardTheme: selectedTheme, logoMode });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-xl border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">
          Challenge {targetUser.displayName || targetUser.verusId}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Configure your game settings</p>

        {/* Mode Picker */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Game Mode</label>
          <div className="flex gap-2">
            <Button
              variant={mode === 'normal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('normal')}
            >
              Normal
            </Button>
            <Button
              variant={mode === 'showcase' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('showcase')}
            >
              Showcase
            </Button>
          </div>
          {mode === 'showcase' && (
            <p className="text-xs text-amber-400 mt-1">Every move stored on-chain live</p>
          )}
        </div>

        {/* Logo Toggle */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Verus Logo</label>
          <div className="flex gap-2">
            {(['off', 'faded', 'centered'] as LogoMode[]).map((lm) => (
              <Button
                key={lm}
                variant={logoMode === lm ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLogoMode(lm)}
              >
                {lm.charAt(0).toUpperCase() + lm.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Board Theme</label>
          <div className="grid grid-cols-5 gap-2">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className="text-left"
                style={{
                  border: selectedTheme === theme.id ? '2px solid #3165D4' : '2px solid transparent',
                  borderRadius: '6px',
                  padding: '4px',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <MiniBoard theme={theme} logoMode={logoMode} />
                <p className="text-xs text-center mt-1 truncate">{theme.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Send Challenge
          </Button>
        </div>
      </div>
    </div>
  );
}
