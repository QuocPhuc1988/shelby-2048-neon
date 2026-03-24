import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tile = {
    id: number;
    value: number;
    position: [number, number];
    mergedFrom?: [Tile, Tile];
};

type GameState = {
    grid: (Tile | null)[][];
    score: number;
    bestScore: number;
    gameOver: boolean;
    gameWon: boolean;
    isSyncing: boolean;
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

            initGame: () => {
                let newGrid = createEmptyGrid();
                newGrid = spawnTile(spawnTile(newGrid));
                set({ grid: newGrid, score: 0, gameOver: false, gameWon: false });
            },

            loadFromShelby: async (address: string) => {
                const { ShelbyService } = await import('@/lib/shelby');
                set({ isSyncing: true });
                const remoteData = await ShelbyService.loadGame(address);
                if (remoteData) {
                    // Re-map simple values to Tile objects
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
                const { grid, score, bestScore, gameOver } = get();
                if (gameOver) return;

                const { newGrid, newScore, moved } = moveGrid(grid, direction);

                if (moved) {
                    const gridWithSpawn = spawnTile(newGrid);
                    const isGameOver = checkGameOver(gridWithSpawn);
                    const updatedScore = score + newScore;
                    const updatedBest = Math.max(bestScore, updatedScore);

                    set({
                        grid: gridWithSpawn,
                        score: updatedScore,
                        bestScore: updatedBest,
                        gameOver: isGameOver,
                    });

                    // Background Sync to Shelby if address is provided
                    if (address) {
                        const { ShelbyService } = await import('@/lib/shelby');
                        set({ isSyncing: true });
                        await ShelbyService.saveGame(address, {
                            grid: gridWithSpawn.map(row => row.map(t => t?.value || null)),
                            score: updatedScore,
                            bestScore: updatedBest,
                            timestamp: Date.now()
                        });
                        set({ isSyncing: false });
                    }
                }
            },
        }),
        {
            name: '2048-shelby-storage',
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
    newGrid[r][c] = {
        id: nextId++,
        value: Math.random() < 0.9 ? 2 : 4,
        position: [r, c],
    };

    return newGrid;
}

function moveGrid(grid: (Tile | null)[][], direction: string) {
    let newGrid = grid.map(row => [...row]);
    let moved = false;
    let newScore = 0;

    // Rotation logic to simplify moving (always move left)
    const rotations = { up: 1, right: 2, down: 3, left: 0 };
    const numRotations = rotations[direction as keyof typeof rotations];

    for (let i = 0; i < numRotations; i++) newGrid = rotateGrid(newGrid);

    for (let r = 0; r < GRID_SIZE; r++) {
        const row = newGrid[r].filter(tile => tile !== null) as Tile[];
        const newRow: (Tile | null)[] = [];

        for (let c = 0; c < row.length; c++) {
            if (c < row.length - 1 && row[c].value === row[c + 1].value) {
                const combinedValue = row[c].value * 2;
                newRow.push({
                    id: nextId++,
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
        if (JSON.stringify(newGrid[r]) !== JSON.stringify(newRow)) moved = true;
        newGrid[r] = newRow;
    }

    for (let i = 0; i < (4 - numRotations) % 4; i++) newGrid = rotateGrid(newGrid);

    // Update positions after rotations
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (newGrid[r][c]) newGrid[r][c]!.position = [r, c];
        }
    }

    return { newGrid, newScore, moved };
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
