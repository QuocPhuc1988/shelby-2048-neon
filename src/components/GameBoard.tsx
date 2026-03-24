'use client';

import React, { useRef, useState, useLayoutEffect } from 'react';
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
    const boardRef = useRef<HTMLDivElement>(null);
    const [cellPositions, setCellPositions] = useState<{ top: number; left: number; width: number }[]>([]);

    // Use useLayoutEffect to measure grid positions before rendering tiles
    useLayoutEffect(() => {
        const calculatePositions = () => {
            if (!boardRef.current) return;
            const cells = boardRef.current.querySelectorAll('.grid-cell');
            const positions = Array.from(cells).map((cell) => {
                const element = cell as HTMLElement;
                return {
                    top: element.offsetTop,
                    left: element.offsetLeft,
                    width: element.offsetWidth,
                };
            });
            setCellPositions(positions);
        };

        calculatePositions();
        window.addEventListener('resize', calculatePositions);
        return () => window.removeEventListener('resize', calculatePositions);
    }, []);

    return (
        <div
            ref={boardRef}
            className="w-full aspect-square bg-[#16161f] rounded-2xl p-4 grid grid-cols-4 grid-rows-4 gap-4 border border-white/5 relative overflow-hidden shadow-2xl box-border"
        >
            {/* Background cells */}
            {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="grid-cell bg-[#1c1c28] rounded-xl border border-white/[0.03]" />
            ))}

            {/* Actual tiles layer */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <AnimatePresence>
                    {grid.flatMap((row, r) =>
                        row.map((tile, c) => {
                            if (!tile || cellPositions.length === 0) return null;
                            const posIndex = r * 4 + c;
                            const pos = cellPositions[posIndex];
                            if (!pos) return null;

                            return (
                                <motion.div
                                    key={tile.id}
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{
                                        scale: 1,
                                        opacity: 1,
                                        x: pos.left,
                                        y: pos.top,
                                    }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                                    className={`absolute flex items-center justify-center rounded-xl text-2xl font-black select-none
                                    ${TILE_COLORS[tile.value] || 'bg-[#ffc107] text-white shadow-xl'}`}
                                    style={{
                                        width: pos.width,
                                        height: pos.width, // Square tiles
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
