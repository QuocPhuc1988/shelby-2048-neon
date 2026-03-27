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

    // JS-based pixel calculation (Safer for html2canvas than CSS calc)
    const [boardSize, setBoardSize] = React.useState(420);
    const gap = 12;
    const cellSize = (boardSize - (gap * 5)) / 4;

    React.useEffect(() => {
        const updateSize = () => {
            const width = Math.min(window.innerWidth * 0.9, 420);
            setBoardSize(width);
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    return (
        <div id="game-board-capture" className="game-container box-border shadow-2xl mx-auto overflow-hidden"
            style={{ width: boardSize, height: boardSize, padding: gap }}>
            {/* Background Cell Grid */}
            <div className="grid-background" style={{ padding: gap, gap }}>
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="grid-cell" />
                ))}
            </div>

            {/* Tile Layer (Web2 Sliding Logic) */}
            <div className="tile-layer" style={{ padding: gap }}>
                <AnimatePresence>
                    {tiles.map((tile) => (
                        <TileItem key={tile.id} tile={tile} gap={gap} cellSize={cellSize} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

const TileItem: React.FC<{ tile: Tile, gap: number, cellSize: number }> = ({ tile, gap, cellSize }) => {
    // Explicit pixel calculation for capture stability
    const xPos = tile.x * (cellSize + gap);
    const yPos = tile.y * (cellSize + gap);

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: 1,
                opacity: 1,
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
            ${tile.mergedFrom ? 'z-20' : 'z-10'}`}
            style={{
                width: cellSize,
                height: cellSize,
                left: 0,
                top: 0,
            }}
        >
            <span className="drop-shadow-sm">{tile.value}</span>
        </motion.div>
    );
};

export default GameBoard;
