'use client';

import React from 'react';
import { Shield, Lock, CheckCircle, Info } from 'lucide-react';

interface BlockchainInfoDialogProps {
  isVisible: boolean;
  onClose: () => void;
  playerName?: string;
}

const BlockchainInfoDialog: React.FC<BlockchainInfoDialogProps> = ({ isVisible, onClose, playerName }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-400 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl relative">
        <button
          className="absolute top-3 right-3 text-white hover:text-blue-200 text-2xl font-bold transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Blockchain-Secured Chess</h2>
            {playerName && (
              <p className="text-blue-200 text-sm">Welcome, {playerName}!</p>
            )}
          </div>
        </div>

        {/* Status Legend */}
        <div className="bg-blue-800/50 rounded-lg p-4 mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Move Status Indicators:
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
              <span className="text-green-300 font-medium">Green</span>
              <span className="text-blue-100">= Stored on blockchain</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-400" />
              <span className="text-orange-300 font-medium">Orange</span>
              <span className="text-blue-100">= Processing/confirming</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
              <span className="text-red-300 font-medium">Red</span>
              <span className="text-blue-100">= Not yet stored</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-300 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-white font-medium">Tamper-Proof</h4>
              <p className="text-blue-200 text-sm">Every move is permanently recorded on the Verus blockchain</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-white font-medium">Fair Play</h4>
              <p className="text-blue-200 text-sm">Blockchain storage prevents cheating and ensures transparency</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-700/30 rounded-lg p-4 mb-6">
          <p className="text-blue-100 text-sm leading-relaxed">
            <strong className="text-white">How it works:</strong> Each move you make is stored on the Verus blockchain 
            after a brief confirmation period. This creates an immutable record of the game that cannot be altered, 
            ensuring complete fairness and transparency for all players.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            onClick={onClose}
          >
            Got it! Let's play
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockchainInfoDialog;