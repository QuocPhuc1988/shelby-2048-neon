'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, Send, Globe, X, ExternalLink, Camera, Timer } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { submitGameRank, mintGameMoment, fetchLeaderboard } from '@/lib/shelby-protocol';

export default function Home() {
  const { tiles, score, bestScore, initGame, move, gameOver, isMoving, isShaking, startTime, endTime } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setHasMounted(true);
    // Only init if not already started
    if (!startTime) initGame();
  }, [initGame, startTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (startTime && !gameOver) {
      interval = setInterval(() => {
        setCurrentTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startTime, gameOver]);

  const totalTime = endTime && startTime ? Math.floor((endTime - startTime) / 1000) : currentTime;

  const handleSyncRank = async () => {
    if (!connected || !account) return;
    setIsSubmittingTx(true);
    try {
      const response = await submitGameRank(
        signAndSubmitTransaction,
        account.address.toString(),
        score,
        totalTime,
        { tiles, score, bestScore, totalTime }
      );
      setLastTxHash(response.hash);
    } catch (e: any) {
      console.error("Sync Rank failed", e);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleMintMoment = async () => {
    if (!connected || !account) return;
    setIsSubmittingTx(true);
    try {
      const html2canvas = (await import('html2canvas' as any)).default;
      const element = document.getElementById('game-board-capture');
      if (element) {
        const canvas = await html2canvas(element, { backgroundColor: '#060608', scale: 2 });
        canvas.toBlob(async (blob: Blob | null) => {
          if (blob) {
            const response = await mintGameMoment(signAndSubmitTransaction, blob);
            setLastTxHash(response.hash);
          }
        }, 'image/png');
      }
    } catch (e: any) {
      console.error("Mint Moment failed", e);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const openRanking = async () => {
    setShowRanking(true);
    const data = await fetchLeaderboard();
    setLeaderboard(data);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current) e.preventDefault();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = e.changedTouches[0].clientX - touchStartPos.current.x;
    const dy = e.changedTouches[0].clientY - touchStartPos.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) {
      if (absDx > absDy) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }
    }
    touchStartPos.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) move('up');
      if (['ArrowDown', 's', 'S'].includes(e.key)) move('down');
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) move('left');
      if (['ArrowRight', 'd', 'D'].includes(e.key)) move('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  if (!hasMounted) return null;

  return (
    <main
      className={`min-h-screen bg-[#060608] text-white flex flex-col items-center p-4 md:p-8 font-sans transition-all overscroll-none overflow-hidden ${isShaking ? 'shake-active' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="w-full max-w-[500px] flex flex-col gap-6 items-center">

        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_20px_rgba(255,42,117,1)]">
              2048 <span className="text-white text-3xl">❤️</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase italic">
              ULTIMATE WEB2 PORT
            </p>
          </div>
          <WalletSelector />
        </div>

        <div className="w-full flex justify-between items-center bg-[#111116] p-2 rounded-2xl border border-white/5">
          <div className="flex gap-2">
            <button onClick={() => initGame()} className="px-4 py-3 bg-[#111116] hover:bg-white/5 rounded-xl border border-white/10 active:scale-95">
              <RefreshCw size={18} className="text-[#ff2a75]" />
            </button>
            <button onClick={openRanking} className="px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Globe size={18} />
            </button>
          </div>
          <div className="flex gap-4 items-center pr-2">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1"><Timer size={10} /> Time</span>
              <span className="text-xl font-black text-white tabular-nums">{totalTime}s</span>
            </div>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-4">
          <div className="bg-[#111116] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ff2a75]" />
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Score</span>
            <span className="text-2xl font-black text-white">{score.toLocaleString()}</span>
          </div>
          <div className="bg-[#111116] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Personal Peak</span>
            <span className="text-2xl font-black text-cyan-400">{bestScore.toLocaleString()}</span>
          </div>
        </div>

        <GameBoard />

        {gameOver && (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <Trophy size={80} className="text-[#ff2a75] mb-4 animate-bounce" />
            <h2 className="text-4xl font-black mb-1 tracking-tighter text-white uppercase italic">SPEED OVER</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Score</span>
                <span className="text-3xl font-black text-[#ff2a75]">{score}</span>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Time</span>
                <span className="text-3xl font-black text-cyan-400">{totalTime}s</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-[300px]">
              <button
                onClick={handleSyncRank}
                disabled={isSubmittingTx}
                className="w-full py-5 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_40px_rgba(255,42,117,0.4)] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Send size={20} /> SYNC RANK TROPHY
              </button>
              <button
                onClick={handleMintMoment}
                disabled={isSubmittingTx}
                className="w-full py-4 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-black rounded-xl border border-indigo-500/30 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                <Camera size={20} /> MINT MOMENT (NFT)
              </button>
              <button onClick={() => initGame()} className="mt-2 text-white/30 font-black uppercase text-[10px] tracking-widest">NEW RUN</button>
              {lastTxHash && (
                <a href={`https://explorer.shelby.xyz/transaction/${lastTxHash}`} target="_blank" className="mt-4 text-[9px] text-cyan-400 font-black underline uppercase flex items-center justify-center gap-1">
                  <ExternalLink size={10} /> Verified on Shelbynet
                </a>
              )}
            </div>
          </div>
        )}

        <footer className="text-center opacity-30 mt-auto py-6">
          <p className="text-[8px] font-black tracking-[0.5em] uppercase text-gray-800">ULTIMATE.SHELBY.PROTOCOL</p>
        </footer>
      </div>
    </main>
  );
}
