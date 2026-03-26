/**
 * Shelby Protocol - Verified Picture Submission (Sync Serialization Fix)
 * 
 * Flow for Explorer Preview:
 * 1. Register Metadata on Aptos Node (register_blob).
 * 2. Upload actual Blob Bytes to Shelby Storage Node (api.shelbynet.shelby.xyz).
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";
export const SHELBY_API_ENDPOINT = "https://api.shelbynet.shelby.xyz/v1/blobs";

/**
 * Helper to convert Uint8Array to Hex string (standard for commitments)
 */
function toHex(array: Uint8Array): string {
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function submitVerifiedPicture(
    signAndSubmitTransaction: any,
    nickname: string,
    score: number,
    imageBlob: Blob,
    format: 'png' | 'jpg'
) {
    try {
        // 1. Calculate SHA-256 Binary Hash
        const arrayBuffer = await imageBlob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const commitment = new Uint8Array(hashBuffer);
        const commitmentHex = toHex(commitment);

        // Expiration: 30 days (Microseconds)
        const expirationUs = (Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)) * 1000000;

        const safeName = nickname.replace(/[^a-z0-9]/gi, '_');
        const p1_name = `${safeName}_${score}.${format}`;

        // 2. STEP 1: Register Metadata on-chain
        console.log(`[Shelby] Registering metadata for ${p1_name}...`);
        const payload = {
            data: {
                function: `${SHELBY_ADDRESS}::blob_metadata::register_blob`,
                typeArguments: [],
                functionArguments: [
                    p1_name,
                    expirationUs.toString(),
                    Array.from(commitment), // Blockchain expects Array of numbers
                    1,
                    imageBlob.size.toString(),
                    0,
                    0
                ],
            }
        };

        const txResponse = await signAndSubmitTransaction(payload);

        // 3. STEP 2: MANDATORY UPLOAD to Shelby API
        // We use Hex serialization for the commitment header to match Merkle Root indexing
        console.log(`[Shelby] Uploading blob bytes to indexer...`);
        const uploadResponse = await fetch(SHELBY_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Shelby-Blob-Id': p1_name,
                'X-Shelby-Commitment': `0x${commitmentHex}` // Added 0x prefix to match Merkle Root
            },
            body: imageBlob
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Sync Upload failed: ${uploadResponse.status} ${errorText}`);
        }

        console.log(`[Shelby] Sync Complete. Explorer Preview should be active.`);
        return txResponse;
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
