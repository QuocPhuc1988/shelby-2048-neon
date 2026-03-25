/**
 * Shelby Protocol Final Evolution - Speedrun & Moment Minting
 * 
 * Logic Requirements:
 * 1. BACKTICKS ( ` ) for SHELBY_MODULE.
 * 2. Uint8Array for p3 Commitment (No Hex Strings).
 * 3. Unique Trophy Name (p1): Rank_[Score]_[Time]s_[Address_Short].
 * 4. Screenshot Minting: SHA-256 of Image Blob.
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

/**
 * Sync Game Rank to Shelbynet
 * p1 format: Rank_{score}_{time}s_{addrShort}
 */
export async function submitGameRank(
    signAndSubmitTransaction: any,
    accountAddress: string,
    score: number,
    totalSeconds: number,
    gameData: any
) {
    try {
        const addrShort = accountAddress.slice(2, 8);
        const trophyName = `Rank_${score}_${totalSeconds}s_${addrShort}`;

        const serializedData = new TextEncoder().encode(JSON.stringify(gameData));
        const hashBuffer = await crypto.subtle.digest('SHA-256', serializedData);
        const commitment = new Uint8Array(hashBuffer);

        const MICROSECONDS_PER_SECOND = 1000000;
        const expirationUs = (Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)) * MICROSECONDS_PER_SECOND;

        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    trophyName,                             // p1: Trophy Name (Speedrun Style)
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    Array.from(commitment),                 // p3: Commitment (Uint8Array)
                    1,                                      // p4: Chunks (u32)
                    serializedData.length.toString(),       // p5: Data Size (u64 string)
                    0,                                      // p6: Payment (u8)
                    0                                       // p7: Encoding (u8)
                ],
            }
        };

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby Rank] Failed:", error);
        throw error;
    }
}

/**
 * Mint Game Moment (Screenshot) to Shelbynet
 * p1: Moment_{timestamp}
 */
export async function mintGameMoment(
    signAndSubmitTransaction: any,
    imageBlob: Blob
) {
    try {
        const arrayBuffer = await imageBlob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const commitment = new Uint8Array(hashBuffer);

        const MICROSECONDS_PER_SECOND = 1000000;
        const expirationUs = (Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)) * MICROSECONDS_PER_SECOND;

        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;
        const momentName = `Moment_${Date.now()}`;

        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    momentName,                             // p1: Image Name
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    Array.from(commitment),                 // p3: Image Hash (Uint8Array)
                    1,                                      // p4: Chunks (u32)
                    imageBlob.size.toString(),              // p5: Image Size (u64 string)
                    0,                                      // p6: Payment (u8)
                    0                                       // p7: Encoding (u8)
                ],
            }
        };

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby Mint] Failed:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    // Top 10 Mock for Shelbynet Explorer View
    return [
        { name: "GiaPhat_Speed", score: 20485, time: 240, address: "0x5ae...bb15", timestamp: Date.now() },
        { name: "Aptos_Pro", score: 18240, time: 310, address: "0x85f...8e6a", timestamp: Date.now() },
        { name: "Fast_Gamer", score: 15600, time: 350, address: "0x123...4567", timestamp: Date.now() },
    ].sort((a, b) => b.score - a.score);
}
