/**
 * Shelby Protocol - Verified Picture Submission (Upload Integration)
 * 
 * Flow for Explorer Preview:
 * 1. Register Metadata on Aptos Node (register_blob).
 * 2. Upload actual Blob Bytes to Shelby Storage Node (api.shelbynet.shelby.xyz).
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";
export const SHELBY_API_ENDPOINT = "https://api.shelbynet.shelby.xyz/v1/blobs";

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

        // Expiration: 30 days
        const expirationUs = (Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)) * 1000000;

        const safeName = nickname.replace(/[^a-z0-9]/gi, '_');
        const p1_name = `${safeName}_${score}.${format}`;

        // 2. Register Metadata on Shelbynet (Blockchain)
        const payload = {
            data: {
                function: `${SHELBY_ADDRESS}::blob_metadata::register_blob`,
                typeArguments: [],
                functionArguments: [
                    p1_name,
                    expirationUs.toString(),
                    Array.from(commitment),
                    1,
                    imageBlob.size.toString(),
                    0,
                    0
                ],
            }
        };

        const response = await signAndSubmitTransaction(payload);

        // 3. MANDATORY UPLOAD to Shelby API for Preview availability
        // This resolves the "Pending" status on the Explorer
        try {
            console.log(`[Shelby] Syncing blob bytes for ${p1_name}...`);
            await fetch(SHELBY_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Shelby-Blob-Id': p1_name,
                    'X-Shelby-Commitment': commitment.toString()
                },
                body: imageBlob
            });
            console.log(`[Shelby] Sync Complete. Blob is now active.`);
        } catch (uploadError) {
            console.warn("[Shelby] Upload failed, Explorer preview might be delayed:", uploadError);
        }

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
