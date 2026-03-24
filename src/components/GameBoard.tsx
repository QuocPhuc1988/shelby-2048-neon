'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';

const TILE_COLORS: Record<number, string> = {
    2: 'bg-[#1e1e2d] text-[#ffffff] shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
    4: 'bg-[#252538] text-[#ffffff] shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
    8: 'bg-[#ff2a75] text-[#ffffff] shadow-[0_0_25px_rgba(255,42,117,0.3)]',
    16: 'bg-[#ff4b8e] text-[#ffffff] shadow-[0_0_25px_rgba(255,75,142,0.3)]',
    32: 'bg-[#ff71a7] text-[#ffffff] shadow-[0_0_25px_rgba(255,113,167,0.3)]',
    64: 'bg-[#3b82f6] text-[#ffffff] shadow-[0_0_25px_rgba(59,130,246,0.3)]',
    128: 'bg-[#60a5fa] text-[#ffffff] shadow-[0_0_25px_rgba(96,165,250,0.3)]',
    256: 'bg-[#93c5fd] text-[#ffffff] shadow-[0_0_35px_rgba(147,197,253,0.4)] border border-white/20',
    512: 'bg-[#a855f7] text-[#ffffff] shadow-[0_0_35px_rgba(168,85,247,0.4)] border border-white/20',
    1024: 'bg-[#c084fc] text-[#ffffff] shadow-[0_0_35px_rgba(192,132,252,0.4)] border border-white/20',
    2048: 'bg-[#ffd700] text-black shadow-[0_0_50px_rgba(255,215,0,0.5)] border-2 border-white/40',
};

const GameBoard: React.FC = () => {
    const { grid } = useGameStore();

    return (
        <div className="w-full h-full bg-[#16161f] rounded-2xl p-4 grid grid-cols-4 grid-rows-4 gap-4 border border-white/5 relative overflow-hidden shadow-2xl">
            {/* Background cells */}
            {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="bg-[#1c1c28] rounded-xl border border-white/[0.03]" />
            ))}

            {/* Actual tiles */}
            <AnimatePresence>
                {grid.flatMap((row, r) =>
                    row.map((tile, c) => {
                        if (!tile) return null;
                        return (
                            <motion.div
                                key={tile.id}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{
                                    scale: 1,
                                    opacity: 1,
                                    x: c * (100 + 16) / 4 + 1.25, // Note: Simplified layout logic for example
                                    y: r * (100 + 16) / 4 + 1.25,
                                }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                className={`absolute w-[calc(25%-16px)] h-[calc(25%-16px)] flex items-center justify-center rounded-xl text-2xl font-bold select-none
                  ${TILE_COLORS[tile.value] || 'bg-[#ffc107] text-white shadow-xl'}`}
                                style={{
                                    top: `calc(${r * 25}% + 16px)`,
                                    left: `calc(${c * 25}% + 16px)`,
                                    width: 'calc(25% - 20px)',
                                    height: 'calc(25% - 20px)',
                                }}
                            >
                                {tile.value}
                            </motion.div>
                        );
                    })
                )}
            </AnimatePresence>
        </div>
    );
};

export default GameBoard;
