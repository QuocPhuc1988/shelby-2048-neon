import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation - Golden Transaction Edition
 * Aligned with: https://explorer.aptoslabs.com/txn/25492936/payload?network=shelbynet
 * 
 * Flow:
 * 1. Serialize Game State to bytes.
 * 2. Calculate SHA-256 Commitment (p3) as a HEX STRING.
 * 3. Provide accurate Data Size (p5) as a STRING.
 * 4. Submit to registered Shelby module.
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

export async function submitGameTransaction(
    signAndSubmitTransaction: any,
    accountAddress: string,
    gameData: GameData
) {
    try {
        console.log("[Shelby] Preparing Golden Standard Payload...");

        // 1. Serialize Data (The "Blob")
        const blobObject = {
            score: gameData.score,
            bestScore: gameData.bestScore,
            grid: gameData.grid,
            timestamp: gameData.timestamp,
            player: accountAddress
        };
        const serializedBlob = new TextEncoder().encode(JSON.stringify(blobObject));

        // 2. Cryptographic Blob Commitment (p3: Hex String!)
        const hashBuffer = await crypto.subtle.digest('SHA-256', serializedBlob);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const commitmentHex = "0x" + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 3. Expiration Time (p2: u64 string, 16 digits)
        const MICROSECONDS_PER_SECOND = 1000000;
        const SECONDS_IN_7_DAYS = 7 * 24 * 60 * 60;
        const expirationUs = (Math.floor(Date.now() / 1000) + SECONDS_IN_7_DAYS) * MICROSECONDS_PER_SECOND;

        // 4. Module name
        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        // 5. Final Payload (Golden Format)
        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    `2048_SCORE_${gameData.score}`,         // p1: Name (string)
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    commitmentHex,                          // p3: Commitment (HEX STRING 0x...)
                    1,                                      // p4: Chunkset Qty (u32 number)
                    serializedBlob.length.toString(),       // p5: File Size (u64 string)
                    0,                                      // p6: Tier (u8 number)
                    0                                       // p7: Encoding (u8 number)
                ],
            }
        };

        console.log("[Shelby] Submitting Transaction (Golden Format):", payload);

        const response = await signAndSubmitTransaction(payload);

        // 6. Optional: Upload to Shelbynet RPC (PUT request)
        // Note: The explorer tx only shows registration. 
        // We trigger the upload separately to satisfy the Storage Provider requirement.
        try {
            await fetch(`https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${accountAddress}/${payload.data.functionArguments[0]}`, {
                method: 'PUT',
                body: serializedBlob,
                headers: {
                    'Content-Length': serializedBlob.length.toString()
                }
            });
            console.log("[Shelby] Data successfully uploaded to Storage Providers.");
        } catch (uploadError) {
            console.warn("[Shelby] Off-chain upload failed, but on-chain registration succeeded:", uploadError);
        }

        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}
