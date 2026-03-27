import {
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET DISCRETE ENDPOINTS (v2.34) ---
const STORAGE_ENDPOINT = "https://api.shelbynet.shelby.xyz/shelby"; // For Binary/Images
const LEDGER_ENDPOINT = "https://api.shelbynet.shelby.xyz/v1";      // For Transactions

const RAW_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
const CLEAN_KEY = RAW_KEY.replace(/^Bearer\s+/i, "").trim();

// MISSION CRITICAL: Use only ONE canonical header as requested
const AUTH_HEADERS = {
    'x-api-key': CLEAN_KEY,
    'Content-Type': 'application/json'
};

const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: LEDGER_ENDPOINT,
});

const aptosClient = new Aptos(aptosConfig);

export async function submitVerifiedPicture(
    signAndSubmitTransaction: any,
    accountAddress: string,
    nickname: string | null,
    score: number,
    imageBlob: Blob
) {
    try {
        const playerTag = nickname || `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`;
        const fileName = `2048_Shelby_${playerTag.replace(/[^a-z0-9]/gi, '_')}_${score}.png`;

        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);
        const totalParts = expectedTotalChunksets(commitments.raw_data_size);

        // 1. REGISTER METADATA (Ledger)
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: totalParts,
            expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            blobSize: commitments.raw_data_size,
            encoding: 0,
        });

        console.log(`[Ledger] Registering blob: ${fileName}`);
        const tx = await signAndSubmitTransaction({ data: payload });
        await aptosClient.waitForTransaction({ transactionHash: tx.hash });

        // 2. MULTIPART UPLOAD (Storage - Discrete URL)
        console.log(`[Storage] Initializing Upload at: ${STORAGE_ENDPOINT}/v1/multipart-uploads`);
        const initResponse = await fetch(`${STORAGE_ENDPOINT}/v1/multipart-uploads`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                rawAccount: accountAddress,
                rawBlobName: fileName,
                rawBlobSize: data.length, // Total file size (Essential for some gateways)
                rawPartSize: data.length  // Size of this specific part
            })
        });

        if (!initResponse.ok) {
            const errBody = await initResponse.text();
            throw new Error(`Init Fail: ${initResponse.status} - ${errBody}`);
        }

        const resData = await initResponse.json();
        // Robust extraction: support both top-level and data-wrapped upload_id
        const uploadId = resData.upload_id || resData.data?.upload_id || resData.id;

        if (!uploadId) {
            console.error("[Shelby] Failed to extract uploadId from response:", resData);
            throw new Error("SERVER_ERROR: Không thể lấy mã uploadId túi (Missing ID)");
        }

        console.log(`[Storage] Uploading Binary Part 0 to ID: ${uploadId}...`);
        // 3. UPLOAD PART (Discrete URL with Uint8Array body)
        const partResponse = await fetch(`${STORAGE_ENDPOINT}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: { ...AUTH_HEADERS, 'Content-Type': 'application/octet-stream' },
            body: data // Use Uint8Array directly for binary integrity
        });

        if (!partResponse.ok) throw new Error(`Part Upload Fail: ${partResponse.status}`);

        // 4. COMPLETE UPLOAD
        const finalizeResponse = await fetch(`${STORAGE_ENDPOINT}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({ partIdentifiers: [{ partNumber: 0 }] })
        });

        if (!finalizeResponse.ok) throw new Error("Complete Upload Fail");

        console.log(`[Shelby Sync] Mission Accomplished! Tx: ${tx.hash}`);
        return tx;
    } catch (error: any) {
        console.error("[Shelby Error]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}
