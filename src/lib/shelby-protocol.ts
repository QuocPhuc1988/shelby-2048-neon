import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET PROTOCOL HYBRID REFINERY (v2.28) ---
/**
 * MISSION CRITICAL: Fixed 401 Unauthorized by using Hybrid Manual Fetch for binary upload.
 */
const SHELBY_RPC_ROOT = "https://api.shelbynet.shelby.xyz";
const SHELBY_STORAGE_RPC = `${SHELBY_RPC_ROOT}/shelby`;
const SHELBY_LEDGER_RPC = `${SHELBY_RPC_ROOT}/v1`;

const RAW_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
const CLEAN_KEY = RAW_KEY.replace(/^Bearer\s+/i, "").trim();

// API Key Integrity Seal (v2.30)
if (!CLEAN_KEY) {
    console.warn("CRITICAL: NEXT_PUBLIC_SHELBY_API_KEY is missing or empty.");
} else {
    console.log(`[Shelby Seal] API Key loaded (${CLEAN_KEY.substring(0, 4)}...${CLEAN_KEY.substring(CLEAN_KEY.length - 4)})`);
}

const HEADERS = {
    'x-api-key': CLEAN_KEY,
    'authorization': `Bearer ${CLEAN_KEY}`,
    'cache-control': 'no-cache',
    'Content-Type': 'application/json'
};

const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: SHELBY_LEDGER_RPC,
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

        // 1. REGISTER METADATA (On-chain)
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: totalParts,
            expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            blobSize: commitments.raw_data_size,
            encoding: 0,
        });

        console.log(`[Shelby Sync] Registering Metadata: ${fileName}`);
        const tx = await signAndSubmitTransaction({ data: payload });
        await aptosClient.waitForTransaction({ transactionHash: tx.hash });

        // 2. MANUAL MULTIPART UPLOAD (Ensures x-api-key is sent)
        console.log(`[Shelby Sync] Initializing Upload...`);
        const initResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                rawAccount: accountAddress,
                rawBlobName: fileName,
                rawPartSize: data.length
            })
        });

        if (!initResponse.ok) {
            const errBody = await initResponse.text();
            throw new Error(`Init Fail (401 Check): ${initResponse.status} - ${errBody}`);
        }

        const uploadInfo = await initResponse.json();
        const uploadId = uploadInfo.upload_id || uploadInfo.data?.upload_id;

        // 3. UPLOAD BINARY PART (Index 0)
        console.log(`[Shelby Sync] Uploading Binary Part 0...`);
        const partResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: { ...HEADERS, 'Content-Type': 'application/octet-stream' },
            body: imageBlob
        });

        if (!partResponse.ok) throw new Error(`Part Upload Fail: ${partResponse.status}`);

        // 4. COMPLETE UPLOAD
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ partIdentifiers: [{ partNumber: 0 }] })
        });

        if (!finalizeResponse.ok) throw new Error("Complete Upload Fail");

        console.log(`[Shelby Sync] 100% SUCCESS! Tx: ${tx.hash}`);
        return tx;
    } catch (error: any) {
        console.error("[Shelby Error]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}
