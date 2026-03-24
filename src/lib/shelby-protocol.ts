import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation - Hardcore & Unique Record Edition
 * 
 * Flow:
 * 1. Calculate Commitment (p3) using SHA-256.
 * 2. Generate UNIQUE Name (p1) to prevent "Already Exists" errors.
 * 3. Format: GiaPhat_Rank_{score}_{address_slice}_{timestamp}
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

export async function submitGameTransaction(
    signAndSubmitTransaction: any,
    accountAddress: string,
    gameData: GameData
) {
    try {
        const blobObject = {
            score: gameData.score,
            bestScore: gameData.bestScore,
            grid: gameData.grid,
            timestamp: gameData.timestamp,
            player: accountAddress
        };
        const serializedBlob = new TextEncoder().encode(JSON.stringify(blobObject));

        const hashBuffer = await crypto.subtle.digest('SHA-256', serializedBlob);
        const commitment = new Uint8Array(hashBuffer);

        const MICROSECONDS_PER_SECOND = 1000000;
        const SECONDS_IN_7_DAYS = 7 * 24 * 60 * 60;
        const expirationUs = (Math.floor(Date.now() / 1000) + SECONDS_IN_7_DAYS) * MICROSECONDS_PER_SECOND;

        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        // UNIQUE Naming to fix "Already Exists" error
        const addressSlice = accountAddress.slice(2, 8);
        const uniqueName = `GiaPhat_Rank_${gameData.score}_${addressSlice}_${Math.floor(Date.now() / 1000)}`;

        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    uniqueName,                             // p1: Dynamic Unique Name
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    Array.from(commitment),                 // p3: Commitment (32-byte SHA-256)
                    1,                                      // p4: Chunkset Qty (u32)
                    serializedBlob.length.toString(),       // p5: Data Size (u64 string)
                    0,                                      // p6: Tier (u8)
                    0                                       // p7: Encoding (u8)
                ],
            }
        };

        console.log("[Shelby] Submitting Unique Record:", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}

/**
 * MOCK: Retrieve Global Ranking from Shelbynet
 * Scans recent transactions to identify Top 10 'GiaPhat_Rank' blobs.
 */
export async function fetchLeaderboard() {
    try {
        // In a real production scenario, we'd query an Indexer API.
        // For Shelbynet Testnet, we fetch the module events to identify registered scores.
        console.log("[Shelby] Fetching Global Ranking from blockchain...");

        // Mocking Top 10 for UI demonstration based on requested contract address
        return [
            { name: "GiaPhat_SDZ", score: 20485, address: "0x5ae...bb15", timestamp: Date.now() },
            { name: "Shelby_Pro", score: 18240, address: "0x85f...8e6a", timestamp: Date.now() - 100000 },
            { name: "Aptos_Fan", score: 15600, address: "0x123...4567", timestamp: Date.now() - 200000 },
            { name: "Ninja_2048", score: 12400, address: "0x987...6543", timestamp: Date.now() - 300000 },
            { name: "GiaPhat_Rank_1042", score: 1042, address: "0xabc...def0", timestamp: Date.now() - 400000 },
        ].sort((a, b) => b.score - a.score);
    } catch (error) {
        console.error("Leaderboard fetch failed", error);
        return [];
    }
}
