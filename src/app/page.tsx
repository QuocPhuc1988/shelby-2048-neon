'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, Send, Globe, X, ExternalLink, Camera, Timer, User, Image as ImageIcon, CheckCircle, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { submitVerifiedPicture, fetchLeaderboard } from '@/lib/shelby-protocol';
import html2canvas from 'html2canvas';

export default function Home() {
  const { tiles, score, bestScore, initGame, move, gameOver, isMoving, isShaking, startTime, endTime } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [nickname, setNickname] = useState('Anony_Shelby');

  // SYNC STATES
  const [syncStatus, setSyncStatus] = useState<'idle' | 'capturing' | 'signing' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    executeVerifiedSubmission();
  };

  const executeVerifiedSubmission = async () => {
    if (!connected || !account || syncStatus !== 'idle') return;

    setSyncStatus('capturing');
    try {
      // 1. CAPTURE PHASE
      if (certificateRef.current) {
        certificateRef.current.style.opacity = '1';
        certificateRef.current.style.visibility = 'visible';
      }

      const element = document.body;
      const canvas = await html2canvas(element, {
        backgroundColor: '#060608',
        scale: 2,
        logging: false,
        useCORS: true,
        scrollX: 0, scrollY: 0,
        width: window.innerWidth, height: window.innerHeight
      });

      if (certificateRef.current) {
        certificateRef.current.style.opacity = '0';
        certificateRef.current.style.visibility = 'hidden';
      }

      const quality = fileFormat === 'image/jpeg' ? 0.8 : undefined;
      const extension = fileFormat === 'image/png' ? 'png' : 'jpg';

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          setSyncStatus('error');
          return;
        }

        // 2. SIGNING PHASE
        setSyncStatus('signing');
        try {
          const response = await submitVerifiedPicture(
            signAndSubmitTransaction,
            account!.address.toString(),
            nickname || 'Anony',
            score,
            blob,
            extension as any
          );
          // 3. SUCCESS
          setSyncStatus('success');
          setErrorMessage(null);
          // SET HASH: Crucial fix for 'transaction/null' bug
          const txHash = response.hash || response.transactionHash;
          setLastTxHash(txHash);
          console.log("Verified Picture Synced! TX:", txHash);
        } catch (txError: any) {
          console.error("Submission failed", txError);
          setSyncStatus('error');
          setErrorMessage(txError.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
      }, fileFormat, quality);
    } catch (e: any) {
      console.error("Sync flow failed", e);
      setSyncStatus('error');
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

        {/* Branding & Wallet */}
        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_20px_rgba(255,42,117,1)]">
              2048 <span className="text-white text-3xl">🛡️</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase italic">
              SHELBY CORE ENGINE
            </p>
          </div>
          <WalletSelector />
        </div>

        {/* Player Plate */}
        <div className="w-full bg-[#111116] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <User size={20} />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Speedrun Identity</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="bg-transparent border-none outline-none text-white font-black text-lg w-full"
              placeholder="Nickname..."
            />
          </div>
        </div>

        {/* Metrics Board */}
        <div className="w-full grid grid-cols-2 gap-4">
          <div className="bg-[#111116] p-4 rounded-2xl border border-white/5 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-10"><Zap size={40} className="text-[#ff2a75]" /></div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 italic">Final Score</span>
            <span className="text-3xl font-black text-white">{score.toLocaleString()}</span>
          </div>
          <div className="bg-[#111116] p-4 rounded-2xl border border-white/5 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-10"><Timer size={40} className="text-cyan-400" /></div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 italic">Total Time</span>
            <span className="text-3xl font-black text-cyan-400 tabular-nums">{totalTime}s</span>
          </div>
        </div>

        <GameBoard />

        <footer className="text-center opacity-30 mt-auto py-6">
          <p className="text-[8px] font-black tracking-[0.5em] uppercase text-gray-800 italic">SHELBY.VERIFIED.RUN.V6</p>
        </footer>
      </div>

      {/* FULL PAGE DYNAMIC CERTIFICATE (Capture Overlay) */}
      <div
        ref={certificateRef}
        className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-2xl pointer-events-none opacity-0 invisible flex flex-col items-center justify-center p-12 border-[24px] border-[#ff2a75] text-center"
      >
        <Trophy size={140} className="text-[#ff2a75] mb-8" />
        <h2 className="text-7xl font-black text-white italic tracking-tighter mb-16 uppercase drop-shadow-[0_0_30px_rgba(255,42,117,1)]">SHELBYNET OFFICAL RUN</h2>

        <div className="w-full max-w-[900px] border-y-4 border-white/10 py-16 mb-16 space-y-12">
          <div className="flex justify-between text-left">
            <div>
              <p className="text-xs text-gray-500 uppercase font-black tracking-[0.6em] mb-4">Player Master</p>
              <p className="text-5xl font-black text-white uppercase">{nickname}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase font-black tracking-[0.6em] mb-4">On-chain Proof</p>
              <p className="text-2xl font-black text-cyan-400 tabular-nums uppercase whitespace-nowrap">SCORE: {score} | TIME: {totalTime}S</p>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-white/5">
            <p className="text-2xl font-black text-white uppercase tracking-widest italic opacity-80 underline underline-offset-8 decoration-cyan-500">
              Player: {nickname} | Wallet: {account?.address?.toString()}
            </p>
          </div>
        </div>

        <p className="text-sm font-black text-gray-600 tracking-[1.5em] uppercase italic opacity-50">CRYPTOGRAPHICALLY VERIFIED ON SHELBY PROTOCOL</p>
      </div>

      {/* GAME OVER TERMINAL */}
      {gameOver && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500 overflow-y-auto">
          {syncStatus === 'success' ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
              <ShieldCheck size={120} className="text-green-500 mb-6 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]" />
              <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-2">RUN SYNCED</h2>
              <p className="text-gray-400 font-bold mb-10 text-lg uppercase tracking-widest">Asset Identified on Shelbynet</p>
            </div>
          ) : syncStatus === 'error' ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700 max-w-[400px]">
              <AlertTriangle size={80} className="text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">LỖI ĐỒNG BỘ</h2>
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6">
                <p className="text-red-400 font-bold text-sm leading-relaxed uppercase tracking-wider">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={() => { setSyncStatus('idle'); setErrorMessage(null); }}
                className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase tracking-[0.2em] text-xs"
              >
                THỬ LẠI
              </button>
            </div>
          ) : (
            <>
              <ImageIcon size={80} className="text-[#ff2a75] mb-4 animate-pulse" />
              <h2 className="text-5xl font-black mb-1 tracking-tighter text-white italic uppercase">SESSION ENDED</h2>
              <p className="text-cyan-400 font-bold mb-10 uppercase tracking-widest">Archive Certified Image</p>
            </>
          )}

          {syncStatus === 'idle' && (
            <div className="flex gap-4 mb-10 bg-[#111116] p-4 rounded-2xl border border-white/5 w-full max-w-[350px]">
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

          <div className="flex flex-col gap-3 w-full max-w-[340px]">
            {syncStatus === 'idle' ? (
              <button
                onClick={() => setShowConsent(true)}
                className="w-full py-6 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_60px_rgba(255,42,117,0.6)] transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xl group"
              >
                <Send size={24} className="group-hover:translate-x-1 transition-transform" /> SENT PICTURE
              </button>
            ) : (syncStatus === 'success' && lastTxHash) ? (
              <a
                href={`https://explorer.shelbynet.shelby.xyz/transaction/${lastTxHash}`}
                target="_blank"
                className="w-full py-6 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-black rounded-xl border-2 border-green-500/30 flex items-center justify-center gap-4 transition-all uppercase tracking-widest text-xl animate-in fade-in duration-500"
              >
                <ExternalLink size={24} /> VIEW ON EXPLORER
              </a>
            ) : (
              <button
                disabled
                className="w-full py-6 bg-[#111116] text-[#ff2a75] font-black rounded-xl border border-white/5 flex items-center justify-center gap-4 uppercase tracking-widest text-xl cursor-wait"
              >
                <Loader2 size={24} className="animate-spin" /> {syncStatus.toUpperCase()}ING...
              </button>
            )}

            <button
              onClick={() => { setLastTxHash(null); setSyncStatus('idle'); initGame(); }}
              className="mt-8 text-white/20 font-black uppercase text-[10px] tracking-[0.5em] hover:text-white transition-all underline underline-offset-8"
            >
              Reset Speedrun
            </button>
          </div>
        </div>
      )}

      {/* CONSENT MODAL (Sync UI Ported from External Build) */}
      {showConsent && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-[#111116] w-full max-w-[400px] rounded-3xl border border-white/10 shadow-3xl text-left flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 pb-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Verified Sync</h3>
              </div>
              <p className="text-gray-400 font-bold text-base leading-relaxed mb-8">
                Bạn có đồng ý chụp ảnh màn hình kết quả và sao lưu lên <span className="text-white italic">Shelby Protocol</span> không? Tấm ảnh này sẽ được lưu trữ công khai làm bằng chứng Speedrun.
              </p>
            </div>

            {/* UI PORT: DIALOG-FOOTER Style */}
            <div className="bg-[#16161f] p-6 flex justify-between items-center border-t border-white/5 gap-4">
              <button
                onClick={() => setShowConsent(false)}
                className="px-6 py-3 text-gray-500 font-black rounded-xl uppercase tracking-widest hover:text-white transition-all active:scale-95 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentAgree}
                className="px-10 py-3 bg-[#ff2a75] text-white font-black rounded-xl uppercase tracking-widest shadow-[0_0_20px_rgba(255,42,117,0.4)] active:scale-95 transition-all text-xs"
              >
                Upload
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
              <h3 className="font-black text-xl uppercase tracking-tighter ml-2 flex-grow text-white font-black">Global Global Ranking</h3>
              <button onClick={() => setShowRanking(false)} className="p-2 text-white/20 hover:text-white"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
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
