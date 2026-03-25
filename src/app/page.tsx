'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, Send, Globe, X, ExternalLink, Camera, Timer, User, Image as ImageIcon } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { mintNFTMoment, fetchLeaderboard } from '@/lib/shelby-protocol';
import html2canvas from 'html2canvas';

export default function Home() {
  const { tiles, score, bestScore, initGame, move, gameOver, isMoving, isShaking, startTime, endTime } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [nickname, setNickname] = useState('Anony_Shelby');
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
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

  const handleSentPicture = async () => {
    if (!connected || !account) return;
    setIsSubmittingTx(true);
    try {
      // Show Certificate overlay before capture
      if (certificateRef.current) {
        certificateRef.current.style.opacity = '1';
        certificateRef.current.style.visibility = 'visible';
      }

      const element = document.getElementById('game-board-capture');
      if (element) {
        const canvas = await html2canvas(element, {
          backgroundColor: '#060608',
          scale: 2,
          logging: false,
          useCORS: true
        });

        // Hide Certificate after capture
        if (certificateRef.current) {
          certificateRef.current.style.opacity = '0';
          certificateRef.current.style.visibility = 'hidden';
        }

        canvas.toBlob(async (blob: Blob | null) => {
          if (blob) {
            // Reusing the mintNFTMoment logic but with the new naming/context
            const response = await mintNFTMoment(
              signAndSubmitTransaction,
              nickname || 'Anony',
              score,
              blob
            );
            setLastTxHash(response.hash);
            console.log("Picture Sent! TX:", response.hash);
          }
        }, 'image/png');
      }
    } catch (e: any) {
      console.error("Sent Picture failed", e);
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
  const onTouchMove = (e: React.TouchEvent) => { if (touchStartPos.current) e.preventDefault(); };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = e.changedTouches[0].clientX - touchStartPos.current.x;
    const dy = e.changedTouches[0].clientY - touchStartPos.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) > 30) {
      if (absDx > absDy) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
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
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
      <div className="w-full max-w-[500px] flex flex-col gap-6 items-center">

        {/* Header */}
        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_20px_rgba(255,42,117,1)]">
              2048 <span className="text-white text-3xl">🧩</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase italic">
              SENT PICTURE ON-CHAIN
            </p>
          </div>
          <WalletSelector />
        </div>

        {/* Player Identity */}
        <div className="w-full bg-[#111116] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <User size={20} />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Player Nickname</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="bg-transparent border-none outline-none text-white font-black text-lg w-full"
              placeholder="Nickname..."
            />
          </div>
        </div>

        {/* Action Center */}
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
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1"><Timer size={10} /> Live Time</span>
              <span className="text-xl font-black text-white tabular-nums">{totalTime}s</span>
            </div>
          </div>
        </div>

        {/* Score Board */}
        <div className="w-full grid grid-cols-2 gap-4">
          <div className="bg-[#111116] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ff2a75]" />
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Current Score</span>
            <span className="text-2xl font-black text-white">{score.toLocaleString()}</span>
          </div>
          <div className="bg-[#111116] p-4 rounded-2xl border border-white/5 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Peak Score</span>
            <span className="text-2xl font-black text-cyan-400">{bestScore.toLocaleString()}</span>
          </div>
        </div>

        {/* Game Master Container */}
        <div className="relative w-full">
          <GameBoard />

          {/* VERIFICATION CERTIFICATE (Visible during capture only) */}
          <div
            ref={certificateRef}
            className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm pointer-events-none opacity-0 invisible flex flex-col items-center justify-center p-6 border-4 border-[#ff2a75]"
          >
            <Trophy size={60} className="text-[#ff2a75] mb-4" />
            <h2 className="text-3xl font-black text-white italic tracking-tighter mb-6 uppercase">SHELBYNET RUN RECORD</h2>

            <div className="w-full grid grid-cols-2 gap-y-4 text-left border-y border-white/10 py-4 mb-4">
              <div>
                <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Player</p>
                <p className="text-lg font-black text-white uppercase">{nickname}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Address</p>
                <p className="text-[10px] font-black text-cyan-400">{account?.address?.toString().slice(0, 10)}...</p>
              </div>
              <div>
                <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Rank/Score</p>
                <p className="text-xl font-black text-[#ff2a75]">{score}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Total Time</p>
                <p className="text-xl font-black text-white">{totalTime}s</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[9px] font-black text-gray-500 tracking-[0.4em] uppercase italic">VERIFIED BY SHELBY PROTOCOL</p>
            </div>
          </div>
        </div>

        {/* GAME OVER TERMINAL */}
        {gameOver && (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
            <ImageIcon size={80} className="text-[#ff2a75] mb-4 animate-pulse" />
            <h2 className="text-5xl font-black mb-1 tracking-tighter text-white italic uppercase">GAME FINISHED</h2>
            <p className="text-cyan-400 font-bold mb-8 uppercase tracking-widest">Status: Ready to Sent Picture</p>

            <div className="flex flex-col gap-3 w-full max-w-[320px]">
              <button
                onClick={handleSentPicture}
                disabled={isSubmittingTx}
                className="w-full py-5 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_50px_rgba(255,42,117,0.5)] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-xl"
              >
                <Send size={24} /> SENT PICTURE
              </button>

              {lastTxHash && (
                <a
                  href={`https://explorer.shelby.xyz/transaction/${lastTxHash}`}
                  target="_blank"
                  className="mt-2 text-[10px] text-cyan-400 font-black underline uppercase flex items-center justify-center gap-2 hover:text-white transition-colors"
                >
                  <ExternalLink size={12} /> View on Shelby Explorer
                </a>
              )}

              <button
                onClick={() => initGame()}
                className="mt-8 text-white/20 font-black uppercase text-[10px] tracking-[0.5em] hover:text-white transition-all underline underline-offset-8"
              >
                Start New Session
              </button>
            </div>
          </div>
        )}

        {/* RANKING LIST */}
        {showRanking && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#111116] w-full max-w-[400px] rounded-3xl border border-white/10 shadow-2xl relative flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#16161f] rounded-t-3xl text-indigo-400">
                <Globe />
                <h3 className="font-black text-xl uppercase tracking-tighter ml-2 flex-grow text-white">Global Ranking</h3>
                <button onClick={() => setShowRanking(false)} className="p-2 text-white/20 hover:text-white"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-2">
                  {leaderboard.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-[#16161f] rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600 font-black">{i + 1}</span>
                        <div className="flex flex-col text-left">
                          <span className="font-black text-sm text-gray-200 uppercase">{item.name}</span>
                          <span className="text-[9px] text-indigo-400 font-bold">{item.time}s Speedrun</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-[#ff2a75]">{item.score}</span>
                        <p className="text-[7px] text-gray-600 font-bold uppercase tracking-widest">Points</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center opacity-30 mt-auto py-6">
          <p className="text-[8px] font-black tracking-[0.5em] uppercase text-gray-800">SHELBY.PROTOCOL.MASTER.V3</p>
        </footer>
      </div>
    </main>
  );
}
