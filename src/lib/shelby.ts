export type GameData = {
    grid: (number | null)[][];
    score: number;
    bestScore: number;
    timestamp: number;
};

export class ShelbyService {
    private static baseUrl = '/api/shelby/sync';

    static async saveGame(address: string, data: GameData): Promise<boolean> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, data }),
            });
            return response.ok;
        } catch (e) {
            console.error("Shelby save failed", e);
            return false;
        }
    }

    static async loadGame(address: string): Promise<GameData | null> {
        try {
            const response = await fetch(`${this.baseUrl}?address=${address}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.error("Shelby load failed", e);
            return null;
        }
    }
}
