import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tile = {
    id: number;
    value: number;
    x: number;
    y: number;
    mergedFrom?: number[];
};

export type GameSnapshot = {
    grid: Tile[];
    score: number;
    status: {
        gameOver: boolean;
        startTime: number | null;
        endTime: number | null;
    };
    timestamp: number;
};

type GameState = {
    tiles: Tile[];
    score: number;
    bestScore: number;
    gameOver: boolean;
    isMoving: boolean;
    isShaking: boolean;
    isPaused: boolean;
    startTime: number | null;
    endTime: number | null;
    initGame: () => void;
    move: (direction: 'up' | 'down' | 'left' | 'right') => void;
    setPaused: (paused: boolean) => void;
    getGameSnapshot: () => GameSnapshot;
    loadGameFromSnapshot: (snapshot: GameSnapshot) => void;
};

const GRID_SIZE = 4;
let nextId = 1;

export const useGameStore = create<GameState>()(
    persist(
        (set, get) => ({
            tiles: [],
            score: 0,
            bestScore: 0,
            gameOver: false,
            isMoving: false,
            isShaking: false,
            isPaused: false,
            startTime: null,
            endTime: null,

            initGame: () => {
                const t1 = createTile(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4));
                let t2 = createTile(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4));
                while (t1.x === t2.x && t1.y === t2.y) {
                    t2 = createTile(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4));
                }
                set({
                    tiles: [t1, t2],
                    score: 0,
                    gameOver: false,
                    isMoving: false,
                    isShaking: false,
                    isPaused: false,
                    startTime: Date.now(),
                    endTime: null
                });
            },

            move: (direction) => {
                const { tiles, score, bestScore, gameOver, isMoving, isPaused } = get();
                if (gameOver || isMoving || isPaused) return;

                const { nextTiles, addedScore, moved, maxMergedValue } = calculateMove(tiles, direction);

                if (moved) {
                    set({ isMoving: true, tiles: nextTiles });

                    if (maxMergedValue >= 1024) {
                        set({ isShaking: true });
                        setTimeout(() => set({ isShaking: false }), 200);
                    }

                    setTimeout(() => {
                        const finalTiles = settleMerge(nextTiles);
                        const spawnedTiles = spawnRandomTile(finalTiles);
                        const isGameOver = checkGameOver(spawnedTiles);

                        set({
                            tiles: spawnedTiles,
                            score: score + addedScore,
                            bestScore: Math.max(bestScore, score + addedScore),
                            gameOver: isGameOver,
                            endTime: isGameOver ? Date.now() : null,
                            isMoving: false
                        });
                    }, 200);
                }
            },

            setPaused: (paused) => set({ isPaused: paused }),

            getGameSnapshot: () => {
                const { tiles, score, gameOver, startTime, endTime } = get();
                return {
                    grid: tiles,
                    score,
                    status: { gameOver, startTime, endTime },
                    timestamp: Date.now()
                };
            },

            loadGameFromSnapshot: (snapshot) => {
                set({
                    tiles: snapshot.grid,
                    score: snapshot.score,
                    gameOver: snapshot.status.gameOver,
                    startTime: snapshot.status.startTime,
                    endTime: snapshot.status.endTime,
                    isMoving: false,
                    isPaused: false
                });
            }
        }),
        {
            name: '2048-ultimate-engine',
            partialize: (state) => ({ bestScore: state.bestScore }),
        }
    )
);

// --- Core Helper Logic (Hardcore Edition) ---

function createTile(x: number, y: number, value?: number): Tile {
    if (!value) {
        const rand = Math.random();
        if (rand < 0.05) value = 8;
        else if (rand < 0.30) value = 4;
        else value = 2;
    }
    return { id: Date.now() + nextId++, x, y, value };
}

function calculateMove(tiles: Tile[], direction: string) {
    let moved = false;
    let addedScore = 0;
    let maxMergedValue = 0;

    const nextTiles = tiles.map(t => ({ ...t }));
    const isVertical = direction === 'up' || direction === 'down';
    const isForward = direction === 'right' || direction === 'down';

    nextTiles.sort((a, b) => {
        if (isVertical) return isForward ? b.y - a.y : a.y - b.y;
        return isForward ? b.x - a.x : a.x - b.x;
    });

    const mergedIds = new Set<number>();

    nextTiles.forEach(tile => {
        let currentX = tile.x;
        let currentY = tile.y;

        while (true) {
            const nextX = isVertical ? currentX : (isForward ? currentX + 1 : currentX - 1);
            const nextY = isVertical ? (isForward ? currentY + 1 : currentY - 1) : currentY;

            if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) break;

            const targetTile = nextTiles.find(t => t.x === nextX && t.y === nextY && !t.mergedFrom);

            if (targetTile) {
                if (targetTile.value === tile.value && !mergedIds.has(targetTile.id) && !mergedIds.has(tile.id)) {
                    tile.x = nextX;
                    tile.y = nextY;
                    tile.mergedFrom = [tile.id, targetTile.id];
                    mergedIds.add(tile.id);
                    mergedIds.add(targetTile.id);
                    addedScore += tile.value * 2;
                    maxMergedValue = Math.max(maxMergedValue, tile.value * 2);
                    moved = true;
                }
                break;
            } else {
                currentX = nextX;
                currentY = nextY;
                moved = true;
            }
        }
        tile.x = currentX;
        tile.y = currentY;
    });

    return { nextTiles, addedScore, moved, maxMergedValue };
}

function settleMerge(tiles: Tile[]): Tile[] {
    const finalTiles: Tile[] = [];
    const processedIds = new Set<number>();

    tiles.forEach(tile => {
        if (processedIds.has(tile.id)) return;

        if (tile.mergedFrom) {
            const partner = tiles.find(t => t.id === tile.mergedFrom![1]);
            const newValue = tile.value * 2;
            finalTiles.push({
                id: Date.now() + nextId++,
                x: tile.x,
                y: tile.y,
                value: newValue
            });
            processedIds.add(tile.id);
            processedIds.add(partner!.id);
        } else {
            const source = tiles.find(t => t.mergedFrom?.includes(tile.id));
            if (!source) {
                finalTiles.push(tile);
                processedIds.add(tile.id);
            }
        }
    });

    return finalTiles;
}

/**
 * HARDCORE MODE: Spawn 2 tiles per move.
 */
function spawnRandomTile(tiles: Tile[]): Tile[] {
    let newTiles = [...tiles];
    for (let i = 0; i < 2; i++) {
        const occupied = new Set(newTiles.map(t => `${t.x},${t.y}`));
        const empty: [number, number][] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (!occupied.has(`${x},${y}`)) empty.push([x, y]);
            }
        }
        if (empty.length === 0) break;
        const [rx, ry] = empty[Math.floor(Math.random() * empty.length)];
        newTiles.push(createTile(rx, ry));
    }
    return newTiles;
}

function checkGameOver(tiles: Tile[]): boolean {
    if (tiles.length < GRID_SIZE * GRID_SIZE) return false;
    for (const t of tiles) {
        const neighbors = [
            { x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y },
            { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 }
        ];
        for (const n of neighbors) {
            const neighbor = tiles.find(nt => nt.x === n.x && nt.y === n.y);
            if (neighbor && neighbor.value === t.value) return false;
        }
    }
    return true;
}
