'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, Send, Globe, X, ExternalLink } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { submitGameTransaction, fetchLeaderboard } from '@/lib/shelby-protocol';

export default function Home() {
  const { grid, score, bestScore, initGame, move, gameOver, isSyncing, isShaking, loadFromShelby } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    setHasMounted(true);
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (connected && account?.address) {
      loadFromShelby(account.address.toString());
    }
  }, [connected, account, loadFromShelby]);

  const handleManualSubmit = async () => {
    if (!connected || !account) return;
    setIsSubmittingTx(true);
    try {
      const response = await submitGameTransaction(
        signAndSubmitTransaction,
        account.address.toString(),
        {
          grid: grid.map(row => row.map(t => t?.value || null)),
          score,
          bestScore: Math.max(score, bestScore),
          timestamp: Date.now()
        }
      );
      setLastTxHash(response.hash);
    } catch (e: any) {
      console.error("Manual submit failed", e);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const openRanking = async () => {
    setShowRanking(true);
    const data = await fetchLeaderboard();
    setLeaderboard(data);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const addr = account?.address?.toString();
      if (['ArrowUp', 'w', 'W'].includes(e.key)) move('up', addr);
      if (['ArrowDown', 's', 'S'].includes(e.key)) move('down', addr);
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) move('left', addr);
      if (['ArrowRight', 'd', 'D'].includes(e.key)) move('right', addr);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, connected, account]);

  if (!hasMounted) return null;

  return (
    <main className={`min-h-screen bg-[#0d0d12] text-white flex flex-col items-center p-4 md:p-8 font-sans overscroll-none touch-none transition-all ${isShaking ? 'shake-active' : ''}`}>
      <div className="w-full max-w-[500px] flex flex-col gap-6">

        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_20px_rgba(255,42,117,1)] leading-tight">
              2048 <span className="text-white text-3xl">❤️</span>
            </h1>
            <p className="text-sm font-black tracking-widest text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] uppercase italic">
              SHELBY BY GIAPHAT SDZ
            </p>
          </div>
          <WalletSelector />
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center bg-[#1a1a24]/50 p-2 rounded-2xl border border-white/5">
          <div className="flex gap-2">
            <button
              onClick={() => initGame()}
              className="px-4 py-3 bg-[#1a1a24] hover:bg-[#252533] transition-all rounded-xl border border-white/10 group active:scale-95"
            >
              <RefreshCw size={18} className="text-[#ff2a75] group-hover:rotate-180 transition-transform duration-500" />
            </button>
            <button
              onClick={openRanking}
              className="px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-all rounded-xl border border-indigo-500/20 active:scale-95 flex items-center gap-2"
            >
              <Globe size={18} />
              <span className="font-bold text-xs uppercase">Ranking</span>
            </button>
          </div>

          <div className="flex gap-2">
            {connected && (
              <button
                onClick={handleManualSubmit}
                disabled={isSubmittingTx}
                className="flex items-center gap-2 px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all rounded-xl border border-cyan-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSubmittingTx ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="font-bold text-xs uppercase">{isSubmittingTx ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}

            <div className={`px-4 py-2 rounded-lg flex items-center gap-2 border transition-colors ${isSyncing ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} className="fill-current" />}
              <span className="text-[11px] font-bold uppercase tracking-tight">{isSyncing ? 'Syncing...' : 'Live'}</span>
            </div>
          </div>
        </div>

        {/* Score Stats Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1a1a24] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ff2a75]" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Score</span>
            <span className="text-3xl font-black text-white tabular-nums">{score.toLocaleString()}</span>
          </div>
          <div className="bg-[#1a1a24] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Best Records</span>
            <span className="text-3xl font-black text-cyan-400 tabular-nums">{bestScore.toLocaleString()}</span>
          </div>
        </div>

        {/* Game Board */}
        <div className="relative w-full">
          <GameBoard />
          {gameOver && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-8 text-center border-2 border-[#ff2a75]/50 overflow-auto">
              <Trophy size={80} className="text-[#ff2a75] mb-4 animate-pulse" />
              <h2 className="text-5xl font-black mb-2 tracking-tighter text-white uppercase italic">Hardcore End</h2>
              <p className="text-gray-400 mb-8 max-w-[300px] text-sm font-bold uppercase">Game Over on Shelbynet. Register your rank now.</p>

              <div className="flex flex-col gap-3 w-full max-w-[280px]">
                <button
                  onClick={handleManualSubmit}
                  disabled={isSubmittingTx}
                  className="w-full py-5 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_40px_rgba(255,42,117,0.6)] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmittingTx ? <RefreshCw size={24} className="animate-spin" /> : <Send size={24} />}
                  SYNC TO SHELBY
                </button>
                {lastTxHash && (
                  <a
                    href={`https://explorer.shelby.xyz/transaction/${lastTxHash}`}
                    target="_blank"
                    className="w-full py-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-black rounded-xl border border-cyan-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <ExternalLink size={14} />
                    View on Explorer
                  </a>
                )}
                <button
                  onClick={() => initGame()}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/50 font-bold rounded-xl text-xs uppercase tracking-widest"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Ranking Modal */}
        {showRanking && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#16161f] w-full max-w-[400px] rounded-3xl border border-white/10 shadow-2xl relative flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1a1a24] rounded-t-3xl">
                <div className="flex items-center gap-2">
                  <Globe className="text-indigo-400" />
                  <h3 className="font-black text-xl uppercase tracking-tighter">Global Ranking</h3>
                </div>
                <button onClick={() => setShowRanking(false)} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white">
                  <X />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {leaderboard.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-[#1a1a24] rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group">
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/5 text-gray-500'}`}>
                          {i + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-black text-sm text-gray-200 group-hover:text-indigo-400 transition-colors uppercase">{item.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{item.address}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-indigo-400">{item.score.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-600 uppercase font-bold tracking-tighter">Points</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-[#1a1a24] rounded-b-3xl border-t border-white/5 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest italic animate-pulse">Live from Shelbynet Testnet</p>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center opacity-40 flex flex-col items-center gap-2 py-4">
          <div className="h-px w-24 bg-white/10" />
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">
            Powered by <span className="text-[#ff2a75]">Shelby Protocol Layer</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
