'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RefreshCw, Zap, ShieldCheck, Send } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { submitGameTransaction } from '@/lib/shelby-protocol';

export default function Home() {
  const { grid, score, bestScore, initGame, move, gameOver, isSyncing, loadFromShelby } = useGameStore();
  const { connected, account, signMessage, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

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
      await loadFromShelby(account.address.toString());
    } catch (e) {
      console.error("Auth failed", e);
    }
  };

  const handleManualSubmit = async () => {
    if (!connected || !account) {
      alert("Please connect your wallet before syncing.");
      return;
    }

    // 1. Better network check (Standard API)
    const walletNetwork = (window as any).aptos?.network?.name || (window as any).petra?.network?.name || "Unknown";

    if (walletNetwork && !walletNetwork.toLowerCase().includes('testnet')) {
      alert(`Current network is ${walletNetwork.toUpperCase()}. Please switch to TESTNET on your wallet.`);
      return;
    }

    // 2. ONLY sync if score is higher
    if (score === 0) {
      alert("Please play the game to get a score before syncing!");
      return;
    }

    if (score <= bestScore && bestScore > 0) {
      const confirmResult = confirm(`Your current score (${score}) is lower than your best record (${bestScore}). Sync anyway?`);
      if (!confirmResult) return;
    }

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
      alert("Submission Successful! TX: " + response.hash);
    } catch (e: any) {
      console.error("Manual submit failed", e);
      const errorMsg = e.toString();
      if (errorMsg.includes("rejected")) {
        alert("Transaction was rejected by user.");
      } else if (errorMsg.includes("sufficient funds")) {
        alert("Insufficient funds for gas or storage fees. Please get some testnet APT.");
      } else {
        alert("Submission Failed. Please check your network or wallet.");
      }
    } finally {
      setIsSubmittingTx(false);
    }
  };

  useEffect(() => {
    // Keyboard support
    const handleKeyDown = (e: KeyboardEvent) => {
      const addr = isAuthenticated ? account?.address?.toString() : undefined;
      // Movement is now throttled by 400ms inside the store
      if (['ArrowUp', 'w', 'W'].includes(e.key)) move('up', addr);
      if (['ArrowDown', 's', 'S'].includes(e.key)) move('down', addr);
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) move('left', addr);
      if (['ArrowRight', 'd', 'D'].includes(e.key)) move('right', addr);
    };

    // Touch support (Mobile)
    let touchStartX = 0;
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      const addr = isAuthenticated ? account?.address?.toString() : undefined;
      if (Math.max(absDx, absDy) > 30) { // Threshold for swipe
        if (absDx > absDy) {
          move(dx > 0 ? 'right' : 'left', addr);
        } else {
          move(dy > 0 ? 'down' : 'up', addr);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [move, isAuthenticated, account]);

  if (!hasMounted) return null;

  return (
    <main className="min-h-screen bg-[#0d0d12] text-white flex flex-col items-center p-4 md:p-8 font-sans overscroll-none touch-none">
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
          <button
            onClick={() => initGame()}
            className="flex items-center gap-2 px-6 py-3 bg-[#1a1a24] hover:bg-[#252533] transition-all rounded-xl border border-white/10 group active:scale-95"
          >
            <RefreshCw size={18} className="text-[#ff2a75] group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-bold text-sm tracking-wide">New Game</span>
          </button>

          <div className="flex gap-2">
            {connected && (
              <button
                onClick={handleManualSubmit}
                disabled={isSubmittingTx} // DISABLED directly after click (Requirement 3)
                className="flex items-center gap-2 px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all rounded-xl border border-cyan-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingTx ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="font-bold text-xs uppercase tracking-wider">{isSubmittingTx ? 'Processing...' : 'Finish & Submit'}</span>
              </button>
            )}

            <div className={`px-4 py-2 rounded-lg flex items-center gap-2 border transition-colors ${isSyncing ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
              {isSyncing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Zap size={14} className="fill-current" />
              )}
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

        {/* Authentication / Sync Alert */}
        {connected && !isAuthenticated && (
          <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 p-4 rounded-2xl border border-orange-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-orange-400" />
              <div>
                <p className="text-xs font-black uppercase tracking-tight text-white">Identity Check</p>
                <p className="text-[10px] text-gray-400">Sign to enable Hot Storage</p>
              </div>
            </div>
            <button
              onClick={handleSignAuth}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest transition-all"
            >
              Link Identity
            </button>
          </div>
        )}

        {/* Game Board */}
        <div className="relative w-full">
          <GameBoard />

          {gameOver && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-8 text-center border-2 border-[#ff2a75]/50">
              <Trophy size={80} className="text-[#ff2a75] mb-4 animate-pulse drop-shadow-[0_0_20px_rgba(255,42,117,1)]" />
              <h2 className="text-5xl font-black mb-2 tracking-tighter text-white">LEVEL END</h2>
              <p className="text-gray-400 mb-8 max-w-[300px] text-sm font-bold uppercase tracking-tight">Successfully scored! Sync your achievement to Shelby Protocol now.</p>

              <div className="flex flex-col gap-3 w-full max-w-[280px]">
                <button
                  onClick={handleManualSubmit}
                  disabled={isSubmittingTx}
                  className="w-full py-5 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-black rounded-xl shadow-[0_0_40px_rgba(255,42,117,0.6)] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmittingTx ? <RefreshCw size={24} className="animate-spin" /> : <Send size={24} />}
                  SUBMIT TO SHELBY
                </button>
                <button
                  onClick={() => initGame()}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/80 font-black rounded-xl transition-all uppercase tracking-widest text-xs"
                >
                  PLAY AGAIN
                </button>
              </div>

              {lastTxHash && (
                <a
                  href={`https://explorer.shelby.xyz/testnet/txn/${lastTxHash}`}
                  target="_blank"
                  className="mt-6 text-[10px] text-cyan-400 font-bold underline uppercase tracking-widest opacity-80 hover:opacity-100"
                >
                  View on Shelby Explorer
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer Credit */}
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
