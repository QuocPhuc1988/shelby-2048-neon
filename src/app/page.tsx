'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export default function Home() {
  const { score, bestScore, initGame, move, gameOver, isSyncing, loadFromShelby } = useGameStore();
  const { connected, account, signMessage } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    initGame();
  }, [initGame]);

  const handleSignAuth = async () => {
    if (!connected || !account) return;
    try {
      const message = `Authorize 2048 Shelby Sync for ${account.address}`;
      const nonce = Date.now().toString();
      await signMessage({
        message,
        nonce,
      });
      setIsAuthenticated(true);
      // Load previous state from Shelby upon authentication
      await loadFromShelby(account.address.toString());
    } catch (e) {
      console.error("Auth failed", e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const addr = isAuthenticated ? account?.address?.toString() : undefined;
      if (['ArrowUp', 'w', 'W'].includes(e.key)) move('up', addr);
      if (['ArrowDown', 's', 'S'].includes(e.key)) move('down', addr);
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) move('left', addr);
      if (['ArrowRight', 'd', 'D'].includes(e.key)) move('right', addr);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, isAuthenticated, account]);

  if (!hasMounted) return null;

  return (
    <main className="min-h-screen bg-[#0d0d12] text-white flex flex-col items-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-[500px] flex flex-col gap-8">

        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="text-6xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_15px_rgba(255,42,117,0.5)]">
              2048
            </h1>
            <p className="text-sm font-bold tracking-widest text-cyan-400 opacity-80 uppercase">
              Shelby Protocol Edition
            </p>
          </div>

          <WalletSelector />
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center bg-[#1a1a24]/50 p-2 rounded-2xl border border-white/5">
          <button
            onClick={() => initGame()}
            className="flex items-center gap-2 px-6 py-3 bg-[#1a1a24] hover:bg-[#252533] transition-all rounded-xl border border-white/10 group active:scale-95"
          >
            <RefreshCw size={18} className="text-[#ff2a75] group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-bold text-sm tracking-wide">New Game</span>
          </button>

          <div className={`px-4 py-2 rounded-lg flex items-center gap-2 border transition-colors ${isSyncing ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            {isSyncing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Zap size={14} className="fill-current" />
            )}
            <span className="text-[11px] font-bold uppercase tracking-tight">{isSyncing ? 'Syncing...' : 'Shelby Live'}</span>
          </div>
        </div>

        {/* Score Stats Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1a1a24] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ff2a75]" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">Current Score</span>
            <span className="text-3xl font-black text-white tabular-nums">{score.toLocaleString()}</span>
          </div>
          <div className="bg-[#1a1a24] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">Best Records</span>
            <span className="text-3xl font-black text-cyan-400 tabular-nums">{bestScore.toLocaleString()}</span>
          </div>
        </div>

        {/* Authentication / Sync Alert */}
        {connected && !isAuthenticated && (
          <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 p-4 rounded-2xl border border-orange-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-orange-400" />
              <div>
                <p className="text-xs font-black uppercase tracking-tight text-white">Identity Verification Needed</p>
                <p className="text-[10px] text-gray-400">Sign to enable Hot Storage sync</p>
              </div>
            </div>
            <button
              onClick={handleSignAuth}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest transition-all"
            >
              Sign Link
            </button>
          </div>
        )}

        {/* Game Board */}
        <div className="relative aspect-square w-full">
          <GameBoard />

          {gameOver && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-8 text-center border-2 border-[#ff2a75]/30">
              <Trophy size={64} className="text-[#ff2a75] mb-4 animate-bounce" />
              <h2 className="text-4xl font-black mb-2 tracking-tight">GAME OVER</h2>
              <p className="text-gray-400 mb-8 max-w-[300px]">Your final submission is ready for the Shelby Protocol ledger.</p>
              <button
                onClick={() => initGame()}
                className="w-full max-w-[200px] py-4 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_30px_rgba(255,42,117,0.4)] transition-all active:scale-95"
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Footer Credit */}
        <footer className="text-center opacity-30 flex flex-col items-center gap-1 mt-4">
          <p className="text-[10px] font-medium tracking-[0.2em] uppercase">Powered by Shelby Hot Storage</p>
          <div className="h-px w-12 bg-white/20" />
        </footer>

      </div>
    </main>
  );
}
