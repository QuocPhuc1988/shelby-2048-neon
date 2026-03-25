'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';

const TILE_COLORS: Record<number, string> = {
    2: 'bg-[#1e1e2d] text-[#ffffff] shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
    4: 'bg-[#252538] text-[#ffffff] shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
    8: 'bg-[#ff2a75] text-[#ffffff] shadow-[0_0_25px_rgba(255,42,117,0.5)]',
    16: 'bg-[#ff4b8e] text-[#ffffff] shadow-[0_0_25px_rgba(255,75,142,0.5)]',
    32: 'bg-[#ff71a7] text-[#ffffff] shadow-[0_0_25px_rgba(255,113,167,0.5)]',
    64: 'bg-[#3b82f6] text-[#ffffff] shadow-[0_0_25px_rgba(59,130,246,0.5)]',
    128: 'bg-[#60a5fa] text-[#ffffff] shadow-[0_0_25px_rgba(96,165,250,0.5)]',
    256: 'bg-[#93c5fd] text-[#ffffff] shadow-[0_0_35px_rgba(147,197,253,0.6)] border border-white/20',
    512: 'bg-[#a855f7] text-[#ffffff] shadow-[0_0_35px_rgba(168,85,247,0.6)] border border-white/20',
    1024: 'bg-[#c084fc] text-[#ffffff] shadow-[0_0_35px_rgba(192,132,252,0.6)] border border-white/20',
    2048: 'bg-[#ffd700] text-black shadow-[0_0_50px_rgba(255,215,0,0.7)] border-2 border-white/40 font-black',
};

const GameBoard: React.FC = () => {
    const { grid } = useGameStore();

    // Web2 Standard: Each cell is 100 / GRID_SIZE %
    // We use CSS Variables (--cell-size, etc.) from globals.css for pixel-perfect scaling.

    return (
        <div id="game-board-capture" className="game-container box-border shadow-2xl mx-auto">
            {/* Background Cell Grid (Lưới nền cố định) */}
            <div className="grid-background">
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="grid-cell" />
                ))}
            </div>

            {/* Tile Container (Lớp chứa ô số) */}
            <div className="tile-layer">
                <AnimatePresence>
                    {grid.flatMap((row, r) =>
                        row.map((tile, c) => {
                            if (!tile) return null;

                            // Position calculation using CSS variables from globals.css
                            // x = c * (cell_size + gap)
                            // y = r * (cell_size + gap)
                            const x = `calc(${c} * (var(--cell-size) + var(--grid-gap)))`;
                            const y = `calc(${r} * (var(--cell-size) + var(--grid-gap)))`;

                            return (
                                <motion.div
                                    key={tile.id}
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{
                                        scale: 1,
                                        opacity: 1,
                                        x: x,
                                        y: y,
                                    }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 400,
                                        damping: 35,
                                        duration: 0.2 // Web2 Speed (200ms)
                                    }}
                                    className={`absolute flex items-center justify-center rounded-lg text-2xl font-black select-none
                                    ${TILE_COLORS[tile.value] || 'bg-[#ffc107] text-white shadow-xl'}`}
                                    style={{
                                        width: 'var(--cell-size)',
                                        height: 'var(--cell-size)',
                                        left: 0,
                                        top: 0,
                                    }}
                                >
                                    <span className="drop-shadow-sm">{tile.value}</span>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default GameBoard;
