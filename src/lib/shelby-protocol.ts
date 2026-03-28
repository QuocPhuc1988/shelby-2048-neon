import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";
import { GameSnapshot } from "../store/useGameStore";

const SHELBY_RPC_ROOT = "https://api.shelbynet.shelby.xyz";
const SHELBY_STORAGE_RPC = `${SHELBY_RPC_ROOT}/shelby`;
const SHELBY_LEDGER_RPC = `${SHELBY_RPC_ROOT}/v1`;

const RAW_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
const CLEAN_KEY = RAW_KEY.replace(/^Bearer\s+/i, "").trim();

const HEADERS = {
    'x-api-key': CLEAN_KEY,
    'cache-control': 'no-cache',
    'Content-Type': 'application/json'
};

const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: SHELBY_LEDGER_RPC,
});

const aptosClient = new Aptos(aptosConfig);

/**
 * Syncs the current game state JSON to Shelby Storage.
 */
export async function syncPlayerState(
    signAndSubmitTransaction: any,
    accountAddress: string,
    snapshot: GameSnapshot
) {
    try {
        const fileName = `2048_Save_${accountAddress}.json`;
        const jsonString = JSON.stringify(snapshot);
        const data = new TextEncoder().encode(jsonString);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);
        const totalParts = expectedTotalChunksets(commitments.raw_data_size);
        const cleanSize = Number(data.length);

        // 1. REGISTER SAVE METADATA
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: totalParts,
            expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            blobSize: Number(commitments.raw_data_size),
            encoding: 0,
        });

        console.log(`[Persistence] Syncing savegame: ${fileName}`);
        const tx = await signAndSubmitTransaction({ data: payload });
        await aptosClient.waitForTransaction({ transactionHash: tx.hash });

        // 2. INITIALIZE UPLOAD
        const initResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                rawAccount: accountAddress,
                rawBlobName: fileName,
                partSize: cleanSize,
                rawBlobSize: cleanSize
            })
        });

        const resData = await initResponse.json();
        const uploadId = resData.uploadId || resData.upload_id || resData.data?.uploadId || resData.id;
        if (!uploadId) throw new Error("Failed to get uploadId for sync");

        // 3. UPLOAD JSON (Part 0)
        await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: { ...HEADERS, 'Content-Type': 'application/octet-stream' },
            body: data
        });

        // 4. COMPLETE
        await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ partIdentifiers: [{ partNumber: 0 }] })
        });

        return tx;
    } catch (error) {
        console.error("[Persistence Error]:", error);
        throw error;
    }
}

/**
 * Fetches the latest game state JSON from Shelby Storage.
 */
export async function fetchPlayerState(accountAddress: string): Promise<GameSnapshot | null> {
    try {
        const fileName = `2048_Save_${accountAddress}.json`;
        console.log(`[Persistence] Fetching savegame: ${fileName}`);

        // Note: Using storage public URL if possible, otherwise we check if it exists
        // Standard Shelbynet pattern: blobs are global by name, no account prefix in URL
        const response = await fetch(`${SHELBY_STORAGE_RPC}/v1/blobs/${fileName}`, {
            headers: HEADERS
        });

        if (!response.ok) {
            if (response.status !== 404) console.warn("[Persistence] Fetch error:", response.status);
            return null;
        }
        return await response.json();
    } catch (e) {
        console.warn("[Persistence] No existing save found or fetch failed.");
        return null;
    }
}

export async function submitVerifiedPicture(
    signAndSubmitTransaction: any,
    accountAddress: string,
    nickname: string | null,
    score: number,
    imageBlob: Blob
) {
    try {
        const playerTag = nickname || `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`;
        const finalFileName = `2048_Shelby_${playerTag.replace(/[^a-z0-9]/gi, '_')}_${score}.png`;

        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const cleanSize = Number(data.length);

        if (isNaN(cleanSize) || cleanSize <= 0) {
            throw new Error("LỖI LOGIC: Kích thước ảnh không xác định (NaN)");
        }

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);
        const totalParts = expectedTotalChunksets(commitments.raw_data_size);

        // 1. REGISTER METADATA
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: finalFileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: totalParts,
            expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            blobSize: Number(commitments.raw_data_size),
            encoding: 0,
        });

        console.log(`[Ledger] Registering blob: ${finalFileName}`);
        const tx = await signAndSubmitTransaction({ data: payload });
        await aptosClient.waitForTransaction({ transactionHash: tx.hash });

        // 2. INITIALIZING UPLOAD
        console.log(`[Storage] Xin mã vận đơn cho: ${finalFileName} (${cleanSize} bytes)`);
        const initResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                rawAccount: accountAddress,
                rawBlobName: finalFileName,
                partSize: cleanSize,
                rawBlobSize: cleanSize,
                rawPartSize: cleanSize,
                blobSize: cleanSize
            })
        });

        const resData = await initResponse.json();
        const uploadId = resData.uploadId || resData.upload_id || resData.data?.uploadId || resData.id;

        if (!uploadId) {
            console.error("[Shelby Error] Server response:", resData);
            throw new Error(`SERVER_ERROR: Không thể lấy mã uploadId. Server trả về: ${JSON.stringify(resData)}`);
        }

        // 3. UPLOAD PART 0
        const partResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: { ...HEADERS, 'Content-Type': 'application/octet-stream' },
            body: data
        });

        if (!partResponse.ok) throw new Error("Upload Part Fail");

        // 4. COMPLETE UPLOAD
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ partIdentifiers: [{ partNumber: 0 }] })
        });

        if (!finalizeResponse.ok) throw new Error("Finalize Fail");

        return tx;
    } catch (error: any) {
        console.error("[Shelby Critical Error]:", error);
        throw error;
    }
}

export async function fetchLeaderboard(): Promise<any[]> {
    try {
        // Try multiple variations if necessary, but start with the most likely
        const response = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads?check=ranking`, { headers: HEADERS });
        if (!response.ok) return [];
        const data = await response.json();
        return data.entries || data.ranking || [];
    } catch (e) {
        return [];
    }
}
