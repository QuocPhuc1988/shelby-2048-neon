'use client';

import React from 'react';
import { useGameStore, Tile } from '@/store/useGameStore';
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
    const { tiles } = useGameStore();

    return (
        <div id="game-board-capture" className="game-container box-border shadow-2xl mx-auto overflow-hidden">
            {/* Background Cell Grid */}
            <div className="grid-background">
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="grid-cell" />
                ))}
            </div>

            {/* Tile Layer (Web2 Sliding Logic) */}
            <div className="tile-layer">
                <AnimatePresence>
                    {tiles.map((tile) => (
                        <TileItem key={tile.id} tile={tile} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

const TileItem: React.FC<{ tile: Tile }> = ({ tile }) => {
    // Standard calc mapping: x/y [0-3] -> pixel positions via CSS variables
    const xPos = `calc(${tile.x} * (var(--cell-size) + var(--grid-gap)))`;
    const yPos = `calc(${tile.y} * (var(--cell-size) + var(--grid-gap)))`;

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: 1,
                opacity: 1,
                // Using x/y for high-performance sliding
                x: xPos,
                y: yPos,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
                x: { type: 'spring', stiffness: 500, damping: 45 },
                y: { type: 'spring', stiffness: 500, damping: 45 },
                scale: { duration: 0.15 },
                opacity: { duration: 0.1 }
            }}
            className={`absolute flex items-center justify-center rounded-lg text-2xl md:text-3xl font-black select-none
            ${TILE_COLORS[tile.value] || 'bg-[#ffc107] text-white shadow-xl'}
            ${tile.mergedFrom ? 'z-20' : 'z-10'}`} // Source of merges slides OVER other tiles
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
};

export default GameBoard;
