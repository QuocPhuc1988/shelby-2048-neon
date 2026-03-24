import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation - Storage Provider Verification Edition
 * Aligned with: https://docs.shelby.xyz/protocol/architecture/smart-contracts
 * 
 * Flow:
 * 1. Serialize Game State to bytes.
 * 2. Calculate SHA-256 Commitment (p3).
 * 3. Provide accurate Data Size (p5).
 * 4. Submit to registered Shelby module.
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

export async function submitGameTransaction(
    signAndSubmitTransaction: any,
    accountAddress: string,
    gameData: GameData
) {
    try {
        console.log("[Shelby] Preparing Verifiable Blob for Storage Providers...");

        // 1. Serialize Data (The "Blob")
        const blobObject = {
            score: gameData.score,
            bestScore: gameData.bestScore,
            grid: gameData.grid,
            timestamp: gameData.timestamp,
            player: accountAddress
        };
        const serializedBlob = new TextEncoder().encode(JSON.stringify(blobObject));

        // 2. Cryptographic Blob Commitment (p3: vector<u8>)
        // SHA-256 allows verification of chunk contents by storage providers.
        const hashBuffer = await crypto.subtle.digest('SHA-256', serializedBlob);
        const commitment = new Uint8Array(hashBuffer);

        // 3. Expiration Time in MICROSECONDS (p2: u64 string)
        const MICROSECONDS_PER_SECOND = 1000000;
        const SECONDS_IN_7_DAYS = 7 * 24 * 60 * 60; // 7 days is safer/standard for tests
        const expirationUs = (Math.floor(Date.now() / 1000) + SECONDS_IN_7_DAYS) * MICROSECONDS_PER_SECOND;

        // 4. Module name using BACKTICKS
        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        // 5. Final Payload Construction (Modern AIP-62)
        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    `2048_SCORE_${gameData.score}`,         // p1: Name (Generic string)
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    Array.from(commitment),                 // p3: Commitment (32-byte SHA-256)
                    1,                                      // p4: Chunkset Qty (u32)
                    serializedBlob.length.toString(),       // p5: Data Size in bytes (u64 string)
                    0,                                      // p6: Payment Tier (u8)
                    0                                       // p7: Encoding (u8)
                ],
            }
        };

        console.log("[Shelby] Submitting Verifiable Transaction:", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Preparation/Submission Failed:", error);
        throw error;
    }
}
