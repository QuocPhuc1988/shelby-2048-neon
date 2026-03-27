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
                rawPartSize: data.length
            })
        });

        if (!initResponse.ok) {
            const errBody = await initResponse.text();
            throw new Error(`Init Fail: ${initResponse.status} - ${errBody}`);
        }

        const uploadInfo = await initResponse.json();
        const uploadId = uploadInfo.upload_id || uploadInfo.data?.upload_id;

        // 3. UPLOAD PART (Discrete URL)
        const partResponse = await fetch(`${STORAGE_ENDPOINT}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: { ...AUTH_HEADERS, 'Content-Type': 'application/octet-stream' },
            body: imageBlob
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
