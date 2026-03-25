import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tile = {
    id: number;
    value: number;
    position: [number, number];
};

type GameState = {
    grid: (Tile | null)[][];
    score: number;
    bestScore: number;
    gameOver: boolean;
    gameWon: boolean;
    isSyncing: boolean;
    isMoving: boolean;
    isShaking: boolean;
    startTime: number | null;
    endTime: number | null;
    initGame: () => void;
    move: (direction: 'up' | 'down' | 'left' | 'right', address?: string) => void;
    loadFromShelby: (address: string) => Promise<void>;
};

const GRID_SIZE = 4;

const createEmptyGrid = () =>
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

export const useGameStore = create<GameState>()(
    persist(
        (set, get) => ({
            grid: createEmptyGrid(),
            score: 0,
            bestScore: 0,
            gameOver: false,
            gameWon: false,
            isSyncing: false,
            isMoving: false,
            isShaking: false,
            startTime: null,
            endTime: null,

            initGame: () => {
                let newGrid = createEmptyGrid();
                newGrid = spawnTile(spawnTile(newGrid));
                set({
                    grid: newGrid,
                    score: 0,
                    gameOver: false,
                    gameWon: false,
                    isMoving: false,
                    isShaking: false,
                    startTime: Date.now(),
                    endTime: null
                });
            },

            loadFromShelby: async (address: string) => {
                const { ShelbyService } = await import('@/lib/shelby');
                set({ isSyncing: true });
                const remoteData = await ShelbyService.loadGame(address);
                if (remoteData) {
                    const restoredGrid = remoteData.grid.map((row, r) =>
                        row.map((val, c) => val ? { id: Math.random(), value: val, position: [r, c] as [number, number] } : null)
                    );
                    set({
                        grid: restoredGrid,
                        score: remoteData.score,
                        bestScore: Math.max(get().bestScore, remoteData.bestScore)
                    });
                }
                set({ isSyncing: false });
            },

            move: async (direction, address) => {
                const { grid, score, bestScore, gameOver, isMoving, startTime } = get();
                if (gameOver || isMoving) return;

                const { newGrid, newScore, moved, maxMerged } = moveGrid(grid, direction);

                if (moved) {
                    set({ isMoving: true });

                    if (maxMerged >= 1024) {
                        set({ isShaking: true });
                        setTimeout(() => set({ isShaking: false }), 200);
                    }

                    const gridWithSpawn = spawnTile(newGrid);
                    const isGameOver = checkGameOver(gridWithSpawn);
                    const updatedScore = score + newScore;
                    const updatedBest = Math.max(bestScore, updatedScore);

                    set({
                        grid: gridWithSpawn,
                        score: updatedScore,
                        bestScore: updatedBest,
                        gameOver: isGameOver,
                        endTime: isGameOver ? Date.now() : null
                    });

                    // Speedrun: Fast 250ms throttle (matches 200ms transition)
                    setTimeout(() => set({ isMoving: false }), 250);

                    // Sync logic for background saving could be added here, 
                    // but the user wants explicit Sync and Minting buttons now.
                }
            },
        }),
        {
            name: '2048-speedrun-shelby',
            partialize: (state) => ({ bestScore: state.bestScore }),
        }
    )
);

// --- Helpers ---

let nextId = 1;

function spawnTile(grid: (Tile | null)[][]): (Tile | null)[][] {
    const emptyCells: [number, number][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (!grid[r][c]) emptyCells.push([r, c]);
        }
    }

    if (emptyCells.length === 0) return grid;

    const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newGrid = grid.map(row => [...row]);

    // Hardcore Probabilities remain (25% for 4, 5% for 8)
    const rand = Math.random();
    let value = 2;
    if (rand < 0.05) value = 8;
    else if (rand < 0.30) value = 4;

    newGrid[r][c] = {
        id: Date.now() + nextId++,
        value,
        position: [r, c],
    };

    return newGrid;
}

function moveGrid(grid: (Tile | null)[][], direction: string) {
    let newGrid = grid.map(row => [...row]);
    let moved = false;
    let newScore = 0;
    let maxMerged = 0;

    const rotations: Record<string, number> = { up: 1, right: 2, down: 3, left: 0 };
    const numRotations = rotations[direction] || 0;

    for (let i = 0; i < numRotations; i++) newGrid = rotateGrid(newGrid);

    for (let r = 0; r < GRID_SIZE; r++) {
        const row = newGrid[r].filter(tile => tile !== null) as Tile[];
        const newRow: (Tile | null)[] = [];

        for (let c = 0; c < row.length; c++) {
            if (c < row.length - 1 && row[c].value === row[c + 1].value) {
                const combinedValue = row[c].value * 2;
                maxMerged = Math.max(maxMerged, combinedValue);
                newRow.push({
                    id: Date.now() + nextId++,
                    value: combinedValue,
                    position: [r, newRow.length],
                });
                newScore += combinedValue;
                c++;
                moved = true;
            } else {
                newRow.push({ ...row[c], position: [r, newRow.length] });
                if (row[c].position[1] !== newRow.length - 1) moved = true;
            }
        }

        while (newRow.length < GRID_SIZE) newRow.push(null);
        if (JSON.stringify(newGrid[r].map(t => t?.value)) !== JSON.stringify(newRow.map(t => t?.value))) moved = true;
        newGrid[r] = newRow;
    }

    for (let i = 0; i < (4 - numRotations) % 4; i++) newGrid = rotateGrid(newGrid);

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (newGrid[r][c]) newGrid[r][c]!.position = [r, c];
        }
    }

    return { newGrid, newScore, moved, maxMerged };
}

function rotateGrid(grid: (Tile | null)[][]) {
    const newGrid = createEmptyGrid();
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            newGrid[c][GRID_SIZE - 1 - r] = grid[r][c];
        }
    }
    return newGrid;
}

function checkGameOver(grid: (Tile | null)[][]): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (!grid[r][c]) return false;
            if (r < GRID_SIZE - 1 && grid[r][c]?.value === grid[r + 1][c]?.value) return false;
            if (c < GRID_SIZE - 1 && grid[r][c]?.value === grid[r][c + 1]?.value) return false;
        }
    }
    return true;
}
