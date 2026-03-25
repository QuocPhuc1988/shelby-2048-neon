/**
 * Shelby Protocol - Verified Picture Submission (Production Grade)
 * 
 * Logic Requirements:
 * 1. p1: ${nickname}_${score}.${ext} (Critical for Explorer Preview)
 * 2. p2: Expiration (u64 microseconds)
 * 3. p3: SHA-256 Binary Hash (Uint8Array)
 * 4. p5: Exact Size (bytes)
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

export async function submitVerifiedPicture(
    signAndSubmitTransaction: any,
    nickname: string,
    score: number,
    imageBlob: Blob,
    format: 'png' | 'jpg'
) {
    try {
        // Calculate SHA-256 Binary Hash of the image file
        const arrayBuffer = await imageBlob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const commitment = new Uint8Array(hashBuffer);

        // Expiration: 30 days in microseconds
        const MICROSECONDS_PER_SECOND = 1000000;
        const expirationUs = (Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)) * MICROSECONDS_PER_SECOND;

        // Protocol Module defined with backticks as requested
        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        const safeName = nickname.replace(/[^a-z0-9]/gi, '_');
        const p1_name = `${safeName}_${score}.${format}`;

        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    p1_name,                                // p1: File Name with Extension
                    expirationUs.toString(),                // p2: Expiration (string u64)
                    Array.from(commitment),                 // p3: Binary SHA-256 Hash (Uint8Array)
                    1,                                      // p4: Chunks (u32)
                    imageBlob.size.toString(),              // p5: Exact Real Size (string u64)
                    0,                                      // p6: Payment (u8)
                    0                                       // p7: Encoding (u8)
                ],
            }
        };

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby Verified Picture] Protocol Error:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "SpeedRunner_99", score: 32768, time: 180, address: "0x5ae...bb15", timestamp: Date.now() },
        { nickname: "Shelby_Ace", score: 16384, time: 210, address: "0x85f...8e6a", timestamp: Date.now() },
    ].sort((a, b) => b.score - a.score);
}
