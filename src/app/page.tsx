'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, Send, Globe, X, ExternalLink, Camera, Timer, User, Image as ImageIcon, CheckCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { submitVerifiedPicture, fetchLeaderboard } from '@/lib/shelby-protocol';
import html2canvas from 'html2canvas';

export default function Home() {
  const { tiles, score, bestScore, initGame, move, gameOver, isMoving, isShaking, startTime, endTime } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [nickname, setNickname] = useState('Anony_Shelby');
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [fileFormat, setFileFormat] = useState<'image/png' | 'image/jpeg'>('image/png');

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

  const handleConsentAgree = () => {
    setShowConsent(false);
    executeCaptureAndSubmit();
  };

  const executeCaptureAndSubmit = async () => {
    if (!connected || !account || isSubmittingTx) return;
    setIsSubmittingTx(true);
    try {
      // Show Verification Certificate before capture
      if (certificateRef.current) {
        certificateRef.current.style.opacity = '1';
        certificateRef.current.style.visibility = 'visible';
      }

      // Capture 'document.body' for genuine 'Screen Hot' context
      const element = document.body;
      const canvas = await html2canvas(element, {
        backgroundColor: '#060608',
        scale: 2,
        logging: false,
        useCORS: true,
        scrollX: 0, scrollY: 0,
        width: window.innerWidth, height: window.innerHeight
      });

      // Hide Certificate after capture
      if (certificateRef.current) {
        certificateRef.current.style.opacity = '0';
        certificateRef.current.style.visibility = 'hidden';
      }

      const quality = fileFormat === 'image/jpeg' ? 0.8 : undefined;
      const extension = fileFormat === 'image/png' ? 'png' : 'jpg';

      canvas.toBlob(async (blob: Blob | null) => {
        if (blob) {
          try {
            const response = await submitVerifiedPicture(
              signAndSubmitTransaction,
              nickname || 'Anony',
              score,
              blob,
              extension as any
            );
            setLastTxHash(response.hash);
            console.log("Verified Picture Submitted! TX:", response.hash);
          } catch (txError) {
            console.error("Protocol submission failed", txError);
            setIsSubmittingTx(false);
          }
        } else {
          setIsSubmittingTx(false);
        }
      }, fileFormat, quality);
    } catch (e: any) {
      console.error("Capture Logic failed", e);
      setIsSubmittingTx(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => { if (touchStartPos.current) e.preventDefault(); };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = e.changedTouches[0].clientX - touchStartPos.current.x;
    const dy = e.changedTouches[0].clientY - touchStartPos.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
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
      <div id="main-capture-zone" className="w-full max-w-[500px] flex flex-col gap-6 items-center p-4 bg-[#060608] relative">

        {/* Branding */}
        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_20px_rgba(255,42,117,1)]">
              2048 <span className="text-white text-3xl">🧩</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase italic">
              VERIFIED PICTURE SYSTEM
            </p>
          </div>
          <WalletSelector />
        </div>

        {/* Identity Plate */}
        <div className="w-full bg-[#111116] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <User size={20} />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Player Identity</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="bg-transparent border-none outline-none text-white font-black text-lg w-full"
              placeholder="Nickname..."
            />
          </div>
        </div>

        {/* Live Metrics */}
        <div className="w-full flex justify-between items-center bg-[#111116] p-4 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-20"><Zap size={40} className="text-[#ff2a75]" /></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Session Score</span>
            <span className="text-2xl font-black text-white">{score.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><Timer size={10} /> Live</span>
            <span className="text-2xl font-black text-white tabular-nums">{totalTime}s</span>
          </div>
        </div>

        <GameBoard />

        <footer className="text-center opacity-30 mt-auto py-6">
          <p className="text-[8px] font-black tracking-[0.5em] uppercase text-gray-800">SHELBY.PROTOCOL.MASTER.V5</p>
        </footer>
      </div>

      {/* FULL PAGE VERIFIED CERTIFICATE (Overlay during capture only) */}
      <div
        ref={certificateRef}
        className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-2xl pointer-events-none opacity-0 invisible flex flex-col items-center justify-center p-12 border-[24px] border-[#ff2a75]"
      >
        <Trophy size={140} className="text-[#ff2a75] mb-8" />
        <h2 className="text-7xl font-black text-white italic tracking-tighter mb-16 uppercase text-center drop-shadow-[0_0_30px_rgba(255,42,117,1)]">OFFICIAL RECORD</h2>

        <div className="w-full max-w-[900px] border-y-4 border-white/10 py-16 mb-16 space-y-12">
          <div className="grid grid-cols-2 text-left">
            <div>
              <p className="text-sm text-gray-500 uppercase font-black tracking-[0.6em] mb-4">Player Master</p>
              <p className="text-6xl font-black text-white uppercase">{nickname}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase font-black tracking-[0.6em] mb-4">Run Stats</p>
              <p className="text-2xl font-black text-cyan-400 tabular-nums">SCORE: {score} | TIME: {totalTime}s</p>
            </div>
          </div>

          {/* MANDATORY IDENTITY WATERMARK */}
          <div className="text-center pt-8 border-t border-white/5">
            <p className="text-2xl font-black text-white uppercase tracking-widest">
              Player: <span className="text-[#ff2a75]">{nickname}</span> | Wallet: <span className="text-cyan-400">{account?.address?.toString()}</span>
            </p>
          </div>
        </div>

        <p className="text-sm font-black text-gray-600 tracking-[1.5em] uppercase italic opacity-50">VERIFIED ON SHELBY PROTOCOL</p>
      </div>

      {/* GAME OVER TERMINAL */}
      {gameOver && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
          {lastTxHash ? (
            <div className="flex flex-col items-center">
              <ShieldCheck size={100} className="text-green-500 mb-6 animate-bounce" />
              <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-2">RUN RECORDED</h2>
              <p className="text-gray-400 font-bold mb-8">Asset verified on Shelbynet.</p>
            </div>
          ) : (
            <>
              <ImageIcon size={80} className="text-[#ff2a75] mb-4 animate-pulse" />
              <h2 className="text-5xl font-black mb-1 tracking-tighter text-white italic uppercase font-black">GAME FINISHED</h2>
              <p className="text-cyan-400 font-bold mb-8 uppercase tracking-widest">Ready to Capture Session</p>
            </>
          )}

          {!lastTxHash && (
            <div className="flex gap-4 mb-10 bg-[#111116] p-4 rounded-2xl border border-white/5 w-full max-w-[320px]">
              <button
                onClick={() => setFileFormat('image/png')}
                className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 ${fileFormat === 'image/png' ? 'bg-[#ff2a75] text-white shadow-[0_0_20px_rgba(255,42,117,1)]' : 'bg-white/5 text-gray-500'}`}
              >
                {fileFormat === 'image/png' && <CheckCircle size={10} />} .PNG
              </button>
              <button
                onClick={() => setFileFormat('image/jpeg')}
                className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 ${fileFormat === 'image/jpeg' ? 'bg-[#ff2a75] text-white shadow-[0_0_20px_rgba(255,42,117,1)]' : 'bg-white/5 text-gray-500'}`}
              >
                {fileFormat === 'image/jpeg' && <CheckCircle size={10} />} .JPG
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-[320px]">
            {!lastTxHash ? (
              <button
                onClick={() => setShowConsent(true)}
                disabled={isSubmittingTx}
                className="w-full py-6 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_60px_rgba(255,42,117,0.6)] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-xl group"
              >
                <Send size={24} className={isSubmittingTx ? 'animate-ping' : 'group-hover:translate-x-1 transition-transform'} />
                {isSubmittingTx ? 'RECORDING...' : 'SENT PICTURE'}
              </button>
            ) : (
              <a
                href={`https://explorer.shelby.xyz/transaction/${lastTxHash}`}
                target="_blank"
                className="w-full py-6 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-black rounded-xl border border-green-500/30 flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-xl"
              >
                <ExternalLink size={24} /> VIEW IMAGE ON EXPLORER
              </a>
            )}

            <button
              onClick={() => { setLastTxHash(null); setIsSubmittingTx(false); initGame(); }}
              className="mt-8 text-white/20 font-black uppercase text-[10px] tracking-[0.5em] hover:text-white transition-all underline outline-offset-8"
            >
              Reset Session
            </button>
          </div>
        </div>
      )}

      {/* CONSENT MODAL (Mandatory Consent Flow) */}
      {showConsent && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#111116] w-full max-w-[350px] p-8 rounded-3xl border border-white/10 shadow-3xl text-center flex flex-col items-center">
            <AlertTriangle size={60} className="text-yellow-500 mb-6" />
            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">Submission Consent</h3>
            <p className="text-gray-400 font-bold text-sm mb-8 leading-relaxed">
              Bạn có đồng ý chụp ảnh màn hình kết quả và sao lưu lên Shelby Protocol không?
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleConsentAgree}
                className="w-full py-4 bg-[#ff2a75] text-white font-black rounded-xl uppercase tracking-widest shadow-[0_0_20px_rgba(255,42,117,0.4)] active:scale-95 transition-all"
              >
                AGREE
              </button>
              <button
                onClick={() => setShowConsent(false)}
                className="w-full py-4 bg-white/5 text-gray-500 font-black rounded-xl uppercase tracking-widest hover:text-white active:scale-95 transition-all"
              >
                DISAGREE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RANKING MODAL */}
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
                        <span className="font-black text-sm text-gray-200 uppercase">{item.nickname}</span>
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
    </main>
  );
}
