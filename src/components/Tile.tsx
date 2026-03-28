'use client';

import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type TileProps = {
    value: number;
    position: [number, number];
};

const TILE_COLORS: Record<number, string> = {
    2: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.5)]",
    4: "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]",
    8: "bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]",
    16: "bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)]",
    32: "bg-pink-500/20 text-pink-400 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.5)]",
    64: "bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.5)]",
    128: "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.6)]",
    256: "bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.6)]",
    512: "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.6)]",
    1024: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_25px_rgba(234,179,8,0.7)]",
    2048: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.8)]",
};

export function Tile({ value, position }: TileProps) {
    const [r, c] = position;

    const tileSize = 80;
    const gapSize = 12;

    // Mobile adjustments logic simplified for this component
    // In a real app we'd use useWindowSize, but for now we'll use responsive classes

    return (
        <motion.div
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: 1,
                opacity: 1,
                x: c * (tileSize + gapSize),
                y: r * (tileSize + gapSize)
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "absolute w-20 h-20 flex items-center justify-center rounded-lg border-2 font-bold text-2xl",
                TILE_COLORS[value] || "bg-slate-700/20 text-slate-400 border-slate-500/50"
            )}
        >
            {value}
        </motion.div>
    );
}
