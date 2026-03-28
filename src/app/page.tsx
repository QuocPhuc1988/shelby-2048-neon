'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import WalletSelector from '@/components/WalletSelector';
import { Trophy, RotateCcw, Share2, ExternalLink } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { syncPlayerState, fetchPlayerState } from '@/lib/shelby-protocol';
import { motion } from 'framer-motion';

export default function Home() {
  const { score, bestScore, initGame, gameOver, move, loadGameFromSnapshot, txHash } = useGameStore();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);

  // KEYBOARD CONTROLS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === "ArrowUp" || e.key === "w") move("up");
      if (e.key === "ArrowDown" || e.key === "s") move("down");
      if (e.key === "ArrowLeft" || e.key === "a") move("left");
      if (e.key === "ArrowRight" || e.key === "d") move("right");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move, gameOver]);

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
    if (!connected || !account) {
      alert("Please connect your wallet first!");
      return;
    }

    // Trigger automated sync logic (placeholder alert for now as per minimal UI)
    const { getGameSnapshot } = useGameStore.getState();
    const snapshot = getGameSnapshot();

    try {
      console.log("[Sync] Manually pushing state to Shelby...");
      await syncPlayerState(signAndSubmitTransaction, account.address.toString(), snapshot);
      alert("Achievement Synced to Shelby Testnet! 🚀");
    } catch (e) {
      console.error("[Sync] Manual sync failed", e);
    }
  };

  useEffect(() => {
    setHasMounted(true);
    initGame();
  }, [initGame]);

  if (!hasMounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="flex flex-col gap-6 mb-8 w-full max-w-md z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            SHELBY 2048
          </h1>
          <div className="flex flex-col items-end gap-2">
            <WalletSelector />
            {connected && account && (
              <div className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest">
                {account.address.toString().slice(0, 6)}...{account.address.toString().slice(-4)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Current Score</span>
            <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{score}</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-3 h-3 text-yellow-500" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Best Score</span>
            </div>
            <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{bestScore}</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => initGame()}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-600 transition-all active:scale-95 group"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-[-180deg] transition-transform duration-500" />
            <span className="font-bold uppercase tracking-widest text-xs">New Game</span>
          </button>
          <button
            onClick={handleManualSync}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl border border-cyan-400/50 transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
          >
            <Share2 className="w-4 h-4" />
            <span className="font-bold uppercase tracking-widest text-xs">Shelby Sync</span>
          </button>
        </div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="z-10"
      >
        <GameBoard onManualSync={handleManualSync} />
      </motion.div>

      <footer className="mt-12 text-center flex flex-col items-center gap-4 z-10">
        <div className="flex gap-6 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
          <a href="https://explorer.shelby.xyz/testnet" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">Explorer</a>
          <a href="https://docs.shelby.xyz/apis/faucet/shelbyusd" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">Faucet</a>
          <a href="https://media-kit.shelby.xyz/" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">Media Kit</a>
          <a href="https://docs.shelby.xyz" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">Docs</a>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-600 font-bold mb-2">
            Shelby Protocol Master V5
          </div>
          <div className="text-[10px] text-slate-700 font-mono">
            VERIFIED ON SHELBYNET • ASSET RECORDED
          </div>
        </div>
      </footer>
    </div>
  );
}
