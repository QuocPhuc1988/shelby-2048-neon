'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Trophy, Zap, Globe, ShoppingBag, LayoutGrid, User, RotateCcw, Save, ShieldCheck, RefreshCw, Loader2, MessageSquare, Image as ImageIcon, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLeaderboard, fetchPlayerState } from '@/lib/shelby-protocol';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

// --- SUB-COMPONENTS ---
const GameGrid = () => {
    const { tiles, isMoving, isShaking, isPaused, won, victoryImage, reset } = useGameStore();
    return (
        <div className={`relative bg-[#111116] p-2 rounded-xl border-4 border-[#1c1c24] w-full aspect-square max-w-[400px] shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-opacity duration-300 ${isShaking ? 'animate-shake' : ''} ${isPaused ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full">
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="bg-[#181820] rounded-lg shadow-inner" />
                ))}
            </div>
            <div className="absolute inset-2 pointer-events-none">
                {tiles.map((tile) => (
                    <div
                        key={tile.id}
                        className={`absolute flex items-center justify-center font-black text-2xl rounded-lg transition-all duration-100 tile-${tile.value}`}
                        style={{
                            width: '22.5%',
                            height: '22.5%',
                            left: `${tile.x * 25}%`,
                            top: `${tile.y * 25}%`,
                        }}
                    >
                        {tile.value}
                    </div>
                ))}
            </div>

            {/* VICTORY OVERLAY */}
            {won && (
                <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300 rounded-lg">
                    <Trophy size={64} className="text-yellow-500 mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
                    <h2 className="text-4xl font-black text-white italic tracking-tighter mb-2 uppercase">VICTORY!</h2>
                    <p className="text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-[0.2em]">You reached the 2048 tile!</p>
                    {victoryImage && (
                        <img src={victoryImage} alt="Victory" className="w-32 h-32 rounded-xl mb-6 shadow-2xl border-2 border-yellow-500/50" />
                    )}
                    <button
                        onClick={reset}
                        className="px-8 py-3 bg-yellow-500 text-black font-black rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    >
                        Continue Playing
                    </button>
                </div>
            )}

            {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] rounded-lg z-50">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-cyan-400" size={32} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/60 px-3 py-1 rounded-full">System Paused</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const FeedView = () => {
    const { feed } = useGameStore();
    return (
        <div className="w-full flex flex-col gap-4 p-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-black italic text-[#ff2a75] uppercase tracking-tighter">Social Feed</h3>
            {feed.length === 0 ? (
                <div className="p-10 text-center opacity-30 italic text-sm border-2 border-dashed border-white/5 rounded-3xl">
                    Your achievements will appear here.
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {feed.map((post) => (
                        <div key={post.id} className="bg-[#111116] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                            <div className="p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2a75] to-indigo-500 flex items-center justify-center text-[10px] font-black uppercase text-white">
                                    {post.address.slice(2, 4)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-white uppercase tracking-wider">{post.address.slice(0, 6)}...{post.address.slice(-4)}</span>
                                    <span className="text-[8px] font-bold text-gray-500 uppercase">{new Date(post.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                            <img src={post.image} alt="High Score" className="w-full aspect-square object-cover" />
                            <div className="p-4 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-4">
                                        <Heart size={20} className="text-gray-600 hover:text-[#ff2a75] cursor-pointer transition-colors" />
                                        <MessageSquare size={20} className="text-gray-600 hover:text-cyan-400 cursor-pointer transition-colors" />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-black text-[#ff2a75]">{post.score.toLocaleString()}</span>
                                        <span className="text-[7px] font-black text-gray-600 uppercase">Score</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const MissionView = () => (
    <div className="w-full flex flex-col gap-4 p-4 animate-in fade-in slide-in-from-bottom-4">
        <h3 className="text-xl font-black italic text-cyan-400 uppercase tracking-tighter">Daily Missions</h3>
        {[
            { task: "Merge two 128 tiles", reward: "50 Gems", progress: 60 },
            { task: "Reach 2048 points", reward: "100 Gems", progress: 20 }
        ].map((m, i) => (
            <div key={i} className="bg-[#111116] p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400">{m.task}</span>
                    <span className="text-xs font-black text-yellow-500">{m.reward}</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${m.progress}%` }} />
                </div>
            </div>
        ))}
    </div>
);

// --- MAIN COMPONENT ---
interface GameBoardProps {
    onManualSync?: () => Promise<void>;
    syncStatus?: string;
    totalTime?: number;
}

export default function GameBoard({ onManualSync, syncStatus = 'idle', totalTime = 0 }: GameBoardProps) {
    const [activeTab, setActiveTab] = useState<'PLAY' | 'GLOBAL' | 'SHOP' | 'FEED' | 'PROFILE'>('PLAY');
    const { score, bestScore, initGame, loadGameFromSnapshot } = useGameStore();
    const { connected, account } = useWallet();
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'GLOBAL') {
            const loadRanking = async () => {
                setLoading(true);
                try {
                    const data = await fetchLeaderboard();
                    setLeaderboard(data);
                } catch (e) {
                    console.error("Failed to load leaderboard", e);
                }
                setLoading(false);
            };
            loadRanking();
        }
    }, [activeTab]);

    const handleRestore = async () => {
        if (!account) return;
        try {
            setLoading(true);
            const snapshot = await fetchPlayerState(account.address.toString());
            if (snapshot) {
                loadGameFromSnapshot(snapshot);
                alert("Session Restored from Shelby! 🚀");
                setActiveTab('PLAY');
            } else {
                alert("No save game found for this address.");
            }
        } catch (e) {
            alert("Restore failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full flex flex-col gap-6 items-center">

            {/* 1. MÀN HÌNH CHÍNH (DYNAMIC CONTENT) */}
            <div className="w-full min-h-[450px] flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                    {activeTab === 'PLAY' && (
                        <motion.div
                            key="play"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full flex flex-col items-center gap-6"
                        >
                            {/* PLAY HEADER METRICS (Targeted for capture) */}
                            <div id="game-board-capture" className="w-full flex flex-col items-center gap-4 bg-[#060608] p-4 rounded-3xl">
                                <div className="w-full grid grid-cols-2 gap-4 max-w-[400px]">
                                    <div className="bg-[#111116] p-3 rounded-2xl border border-white/5 flex flex-col">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic">Score</span>
                                        <span className="text-xl font-black text-white">{score.toLocaleString()}</span>
                                    </div>
                                    <div className="bg-[#111116] p-3 rounded-2xl border border-white/5 flex flex-col">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic">Time</span>
                                        <span className="text-xl font-black text-cyan-400 tabular-nums">{totalTime}s</span>
                                    </div>
                                </div>
                                <GameGrid />
                            </div>

                            <div className="flex gap-4 w-full max-w-[400px] px-4">
                                <button onClick={initGame} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95">
                                    <RotateCcw size={16} /> New Game
                                </button>
                                <button className="flex-1 py-4 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-2xl border border-indigo-500/30 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                                    <Zap size={16} /> Undo
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'FEED' && <FeedView key="feed" />}

                    {activeTab === 'GLOBAL' && (
                        <motion.div
                            key="global"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-[400px] flex flex-col gap-4 p-4"
                        >
                            <h3 className="text-xl font-black italic text-indigo-400 uppercase tracking-tighter">Global Ranking</h3>
                            {loading ? (
                                <div className="p-10 text-center animate-pulse text-indigo-400 font-bold uppercase tracking-widest text-xs">Syncing with Shelby...</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {leaderboard.length > 0 ? (
                                        leaderboard.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-4 bg-[#111116] rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-gray-600 font-black w-4">{i + 1}</span>
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-black text-sm text-gray-200 uppercase truncate max-w-[120px]">{item.nickname || 'Anony'}</span>
                                                        <span className="text-[9px] text-indigo-400 font-bold">{item.time || 0}s Run</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-[#ff2a75]">{item.score?.toLocaleString() || 0}</span>
                                                    <p className="text-[7px] text-gray-600 font-bold uppercase tracking-widest">Points</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-10 text-center opacity-30 italic text-sm">No records found on ShelbyNet.</div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'PROFILE' && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="w-full max-w-[400px] flex flex-col gap-6 p-4"
                        >
                            <h3 className="text-xl font-black italic text-[#ff2a75] uppercase tracking-tighter">Player Profile</h3>
                            <div className="bg-[#111116] p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-4 text-center">
                                <div className="p-5 bg-indigo-500/10 rounded-full text-indigo-400 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                                    <User size={48} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Connected Identity</span>
                                    <span className="text-sm font-black text-white font-mono">{account?.address.toString().slice(0, 8)}...{account?.address.toString().slice(-8)}</span>
                                </div>

                                <div className="w-full grid grid-cols-2 gap-4 mt-4">
                                    <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Score</p>
                                        <p className="text-lg font-black text-white">{score.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Best Run</p>
                                        <p className="text-lg font-black text-[#ff2a75]">{bestScore.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="w-full flex flex-col gap-3 mt-4">
                                    <button
                                        disabled={loading || !connected || syncStatus !== 'idle'}
                                        onClick={onManualSync}
                                        className="w-full py-4 bg-[#ff2a75]/10 hover:bg-[#ff2a75]/20 text-[#ff2a75] border border-[#ff2a75]/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30"
                                    >
                                        {syncStatus !== 'idle' ? <Loader2 className="animate-spin text-[#ff2a75]" size={16} /> : <Save size={16} />}
                                        Sync Player State (Cloud)
                                    </button>
                                    <button
                                        disabled={loading || !connected}
                                        onClick={handleRestore}
                                        className="w-full py-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                        Restore Game Session
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'SHOP' && (
                        <div key="shop" className="p-10 text-center flex flex-col items-center gap-4 animate-pulse">
                            <ShoppingBag size={48} className="text-yellow-500 opacity-20" />
                            <p className="text-[#ff2a75] font-black tracking-widest uppercase italic text-xs">Shop module coming soon...</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* 2. BOTTOM NAVIGATION BAR (The dApp Heart) */}
            <nav className="fixed bottom-0 left-0 right-0 h-24 bg-[#0d0d12]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-6 z-[100] safe-area-bottom">
                <NavButton active={activeTab === 'PLAY'} icon={<LayoutGrid />} label="PLAY" onClick={() => setActiveTab('PLAY')} />
                <NavButton active={activeTab === 'GLOBAL'} icon={<Globe />} label="RANK" onClick={() => setActiveTab('GLOBAL')} />
                <NavButton active={activeTab === 'FEED'} icon={<MessageSquare />} label="FEED" onClick={() => setActiveTab('FEED')} />
                <NavButton active={activeTab === 'SHOP'} icon={<ShoppingBag />} label="SHOP" onClick={() => setActiveTab('SHOP')} />
                <NavButton active={activeTab === 'PROFILE'} icon={<User />} label="ME" onClick={() => setActiveTab('PROFILE')} />
            </nav>

            {/* Footer spacing */}
            <div className="h-24 w-full" />
        </div>
    );
}

function NavButton({ active, icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-[#ff2a75] scale-110' : 'text-gray-600 hover:text-gray-400'}`}
        >
            <div className={`${active ? 'drop-shadow-[0_0_10px_rgba(255,42,117,1)]' : ''}`}>
                {React.cloneElement(icon, { size: active ? 28 : 24 })}
            </div>
            <span className={`text-[8px] font-black tracking-widest ${active ? 'opacity-100 mt-1' : 'opacity-0 h-0 overflow-hidden'}`}>{label}</span>
        </button>
    );
}
