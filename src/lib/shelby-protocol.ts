/**
 * Shelby Protocol - Ultimate NFT Moment Minting
 * 
 * Logic Requirements:
 * 1. p1: ${nickname}_${score} (No special characters recommended).
 * 2. p3: SHA-256 of Image Blob as Uint8Array (binary hash).
 * 3. p5: Actual Image Size (bytes).
 * 4. BACKTICKS ( ` ) for SHELBY_MODULE.
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

/**
 * Mint NFT Moment to Shelbynet
 * p1: nickname_score
 * p3: binary SHA-256 hash
 */
export async function mintNFTMoment(
    signAndSubmitTransaction: any,
    nickname: string,
    score: number,
    imageBlob: Blob
) {
    try {
        // Calculate SHA-256 Binary Hash
        const arrayBuffer = await imageBlob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const commitment = new Uint8Array(hashBuffer);

        // Expiration: 30 days
        const MICROSECONDS_PER_SECOND = 1000000;
        const expirationUs = (Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)) * MICROSECONDS_PER_SECOND;

        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        // Sanitize name: remove non-alphanumeric for safety
        const safeName = nickname.replace(/[^a-z0-9]/gi, '_');
        const momentId = `${safeName}_${score}`;

        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    momentId,                               // p1: NFT Name (Nick_Score)
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    Array.from(commitment),                 // p3: Binary Hash (Uint8Array)
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
        console.error("[Shelby NFT Mint] Failed:", error);
        throw error;
    }
}

/**
 * Fetch Top 10 from Shelbynet (Mock for Speedrun List)
 */
export async function fetchLeaderboard() {
    return [
        { name: "SpeedRunner_99", score: 32768, time: 180, address: "0x5ae...bb15", timestamp: Date.now() },
        { name: "Shelby_Ace", score: 16384, time: 210, address: "0x85f...8e6a", timestamp: Date.now() },
        { name: "NeonWatcher", score: 8192, time: 245, address: "0x123...4567", timestamp: Date.now() },
    ].sort((a, b) => b.score - a.score);
}
