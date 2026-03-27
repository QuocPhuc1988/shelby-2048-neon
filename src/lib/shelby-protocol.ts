import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

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

        // 1. REGISTER METADATA (Ví xác nhận)
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: totalParts,
            expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            blobSize: commitments.raw_data_size,
            encoding: 0,
        });

        const tx = await signAndSubmitTransaction({ data: payload });
        await aptosClient.waitForTransaction({ transactionHash: tx.hash });

        // 2. INITIALIZING UPLOAD (Refinery v4.0 - Anti-NaN Edition)
        const cleanSize = Number(data.length);
        if (isNaN(cleanSize) || cleanSize <= 0) {
            throw new Error("LỖI LOGIC: Kích thước ảnh không xác định (NaN)");
        }

        console.log(`[Storage] Xin mã vận đơn cho: ${fileName} (${cleanSize} bytes)`);
        const initResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                rawAccount: accountAddress,
                rawBlobName: fileName,
                partSize: cleanSize,   // SERVER CRITICAL: Đích danh trường partSize
                rawBlobSize: cleanSize, // Redundancy 1
                rawPartSize: cleanSize, // Redundancy 2
                blobSize: cleanSize     // Redundancy 3
            })
        });

        const resData = await initResponse.json();

        // --- ĐOẠN FIX CHÍ MẠNG Ở ĐÂY ---
        // Bắt ID (CamelCase như log đã báo)
        const uploadId = resData.uploadId || resData.upload_id || resData.data?.uploadId || resData.id;

        if (!uploadId) {
            console.error("[Shelby Error] Server response:", resData);
            throw new Error(`SERVER_ERROR: Không thể lấy mã uploadId. Server trả về: ${JSON.stringify(resData)}`);

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
