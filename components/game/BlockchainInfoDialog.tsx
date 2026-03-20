'use client';

import React from 'react';
import { Shield, Link2, Hash, FileCheck, Trophy, Info } from 'lucide-react';

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
            <h2 className="text-xl font-bold text-white">Blockchain-Verified Chess</h2>
            {playerName && (
              <p className="text-blue-200 text-sm">Welcome, {playerName}!</p>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-blue-800/50 rounded-lg p-4 mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            How It Works
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <p className="text-blue-100 text-sm">Each move is signed and linked to the previous move, forming a <strong className="text-white">cryptographic hash chain</strong> that proves the exact sequence of play.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <p className="text-blue-100 text-sm">When the game ends, the full chain is <strong className="text-white">verified</strong> and a final game hash is computed — a single fingerprint of the entire game.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <p className="text-blue-100 text-sm">The complete game record is stored on the Verus blockchain as a <strong className="text-white">SubID under ChessGame@</strong> — a permanent, publicly verifiable identity with all game data.</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-blue-300 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-white font-medium">Hash Chain Integrity</h4>
              <p className="text-blue-200 text-sm">Every move cryptographically links to the last — no move can be altered or inserted without breaking the chain.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Hash className="w-5 h-5 text-blue-300 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-white font-medium">VDXF Data Descriptors</h4>
              <p className="text-blue-200 text-sm">Game data is stored in self-describing fields that any Verus node can read and verify natively.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileCheck className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-white font-medium">On-Chain Verification</h4>
              <p className="text-blue-200 text-sm">Anyone can look up the game SubID and independently verify the hash chain, players, and result.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-amber-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-white font-medium">Tournament Mode</h4>
              <p className="text-blue-200 text-sm">Optionally store per-move signatures on chain for competitive play with full audit trails.</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-700/30 rounded-lg p-4 mb-6">
          <p className="text-blue-100 text-sm leading-relaxed">
            <strong className="text-white">On-chain record:</strong> Each completed game becomes a Verus SubID
            (e.g. <span className="font-mono text-blue-300">game0008.ChessGame@</span>) containing players, moves,
            result, game hash, and signatures — all stored as DataDescriptors with registered VDXF keys.
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
