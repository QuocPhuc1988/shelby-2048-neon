'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, Loader2 } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { submitVerifiedPicture, syncPlayerState, fetchPlayerState } from '@/lib/shelby-protocol';
import html2canvas from 'html2canvas';

export default function Home() {
  const { score, initGame, gameOver, isShaking, startTime, endTime, loadGameFromSnapshot, move } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [nickname, setNickname] = useState('Anony_Shelby');

  // SYNC STATES
  const [syncStatus, setSyncStatus] = useState<'idle' | 'capturing' | 'signing' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PLAY' | 'GLOBAL' | 'SHOP' | 'FEED' | 'PROFILE'>('PLAY');

  // MOVEMENT CONTROLS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (syncStatus !== 'idle' || gameOver) return;

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': move('up'); break;
        case 'ArrowDown': case 's': case 'S': move('down'); break;
        case 'ArrowLeft': case 'a': case 'A': move('left'); break;
        case 'ArrowRight': case 'd': case 'D': move('right'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, syncStatus, gameOver]);

  // TOUCH SWIPE LOGIC
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || syncStatus !== 'idle' || gameOver) return;

    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 30) {
      if (absX > absY) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }
    }
    setTouchStart(null);
  };

  // AUTO-RESTORE SESSION
  useEffect(() => {
    if (connected && account) {
      const restoreSession = async () => {
        try {
          const snapshot = await fetchPlayerState(account.address.toString());
          if (snapshot) {
            loadGameFromSnapshot(snapshot);
            console.log("[Persistence] Game Session Restored.");
          }
        } catch (e) {
          console.warn("[Persistence] No existing save found on cloud.");
        }
      };
      restoreSession();
    }
  }, [connected, account, loadGameFromSnapshot]);

  const handleManualSync = async () => {
    if (!connected || !account || syncStatus !== 'idle') return;

    const { setPaused, getGameSnapshot } = useGameStore.getState();
    setPaused(true);
    setSyncStatus('capturing');

    try {
      // 1. ENSURE PLAY TAB IS ACTIVE FOR CAPTURE
      const originalTab = activeTab;
      if (activeTab !== 'PLAY') {
        setActiveTab('PLAY');
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const captureTarget = document.getElementById('game-board-capture');
      if (!captureTarget) throw new Error("Thất bại khi tìm màn hình chụp (Capture Target Missing)");

      const canvas = await html2canvas(captureTarget, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#060608',
        logging: false,
      });

      const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!imageBlob) throw new Error("Lỗi khởi tạo ảnh.");

      const snapshot = getGameSnapshot();

      // 2. PARALLEL SYNC
      setSyncStatus('signing');
      const [pngResult, jsonResult] = await Promise.all([
        submitVerifiedPicture(signAndSubmitTransaction, account.address.toString(), nickname, score, imageBlob),
        syncPlayerState(signAndSubmitTransaction, account.address.toString(), snapshot)
      ]);

      if (jsonResult) {
        setSyncStatus('success');
        const { setTxHash, addToFeed } = useGameStore.getState();
        setTxHash(jsonResult.hash || "0x_synced");

        const reader = new FileReader();
        reader.readAsDataURL(imageBlob);
        reader.onloadend = () => {
          addToFeed({ score, image: reader.result as string, address: account.address.toString() });
        };

        if (originalTab === 'PROFILE') setActiveTab('PROFILE');
        alert("Persistence Bridge Synced! 🚀");
      }
    } catch (e: any) {
      const isRejected = e.message?.toLowerCase().includes("rejected") || e.code === 4001;

      if (isRejected) {
        console.warn("[Sync] User rejected the transaction.");
        setSyncStatus('idle');
      } else {
        console.error("Sync failed", e);
        setSyncStatus('error');
        setErrorMessage(e.message || "Đã có lỗi xảy ra.");
      }
    } finally {
      const { setPaused } = useGameStore.getState();
      setPaused(false);
    }
  };

  const [currentTime, setCurrentTime] = useState(0);
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

  if (!hasMounted) return null;

  return (
    <main
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`min-h-screen bg-[#060608] text-white flex flex-col items-center p-4 md:p-8 transition-all overscroll-none overflow-x-hidden ${isShaking ? 'shake-active' : ''}`}>

      <div className="w-full max-w-[500px] flex flex-col gap-8 items-center relative">
        <header className="w-full flex justify-between items-start pt-4 px-2">
          <div className="flex flex-col">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#ff2a75] drop-shadow-[0_0_15px_rgba(255,42,117,1)]">
              SHELBY <span className="text-white text-2xl ml-1 italic">2048</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.4em] text-cyan-400 uppercase italic opacity-80">PERSISTENCE ENGINE</p>
          </div>
          <WalletSelector />
        </header>

        <GameBoard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onManualSync={handleManualSync}
          syncStatus={syncStatus}
          totalTime={totalTime}
        />

        <footer className="opacity-20 py-8">
          <p className="text-[8px] font-black tracking-[0.8em] uppercase text-gray-500 italic">SHELBY.PROTOCOL.NET</p>
        </footer>
      </div>

      {gameOver && syncStatus === 'idle' && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500">
          <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-8 text-center">RUN COMPLETE</h2>
          <div className="flex flex-col items-center gap-4 text-center mb-10">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Final Score</span>
            <span className="text-7xl font-black text-[#ff2a75]">{score.toLocaleString()}</span>
          </div>
          <button
            onClick={() => { setSyncStatus('idle'); initGame(); }}
            className="px-12 py-5 bg-[#ff2a75] text-white font-black rounded-2xl shadow-[0_0_40px_rgba(255,42,117,0.4)] uppercase tracking-widest text-xl active:scale-95 transition-all"
          >
            Start New Session
          </button>
        </div>
      )}
    </main>
  );
}
