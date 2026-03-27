import {
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET ULTIMATE PRODUCTION STABILIZATION (v2.18) ---
/**
 * IDENTITY & VISUAL REFINEMENT: 
 * Upgraded naming logic to prioritize Identity: Nickname -> Wallet -> Fallback.
 */
const SHELBY_RPC_ROOT = "https://api.shelbynet.shelby.xyz";
const SHELBY_LEDGER_RPC = `${SHELBY_RPC_ROOT}/v1`;
const SHELBY_STORAGE_RPC = `${SHELBY_RPC_ROOT}/shelby`;

// Authentication Normalization
const getCleanApiKey = () => {
    const raw = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
    return raw.replace(/^bearer\s+/i, "").trim();
};

const RAW_KEY = getCleanApiKey();

const HEADERS = {
    'x-api-key': RAW_KEY,
    'Content-Type': 'application/json'
};

// Aptos SDK Config (v5.2.1 Pinned)
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
    imageBlob: Blob,
    format: 'png' | 'jpg'
) {
    let fileName = "";
    let data: Uint8Array = new Uint8Array();

    try {
        // --- UPGRADED NAMING LOGIC (v2.18) ---
        // 1. Priority: Nickname -> 2. Wallet Address -> 3. Fallback
        let playerIdentity = nickname && nickname.trim() !== "" ? nickname.trim() : accountAddress;

        if (!playerIdentity) {
            const timestamp = Math.floor(Date.now() / 1000);
            playerIdentity = `2048_shelby_${timestamp}`;
        }

        // Clean name (alphanumeric + underscore only) and limit length
        const cleanName = playerIdentity.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        fileName = `${cleanName}_${score}.${format}`;

        console.log(`[Đồng bộ Shelby] Xử lý Identity: ${cleanName}`);

        const arrayBuffer = await imageBlob.arrayBuffer();
        data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Đồng bộ Shelby] Bước 2: Đăng ký Chuỗi...`);
        const expirationMicros = (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000;

        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: expectedTotalChunksets(commitments.raw_data_size),
            expirationMicros: expirationMicros,
            blobSize: commitments.raw_data_size,
            encoding: 0,
        });

        const transactionResponse = await signAndSubmitTransaction({ data: payload });

        console.log(`[Đồng bộ Shelby] Chờ Giao dịch: ${transactionResponse.hash}`);
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });

        console.log(`[Đồng bộ Shelby] Bước 3: Khởi tạo Multipart Upload...`);

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
            const body = await initResponse.text();
            throw new Error(`Init Fail: ${initResponse.status} - ${body}`);
        }

        const uploadInfo = await initResponse.json();
        const uploadId =
            uploadInfo.upload_id ||
            uploadInfo.uploadId ||
            (uploadInfo.upload_info && uploadInfo.upload_info.upload_id) ||
            (uploadInfo.data && uploadInfo.data.upload_id);

        if (!uploadId || uploadId === "undefined") {
            console.error("[Đồng bộ Shelby] LỖI Metadata:", JSON.stringify(uploadInfo));
            throw new Error("Lỗi hệ thống: Không thể gán Upload ID.");
        }

        console.log(`[Đồng bộ Shelby] ID: ${uploadId}`);

        // 2. UPLOAD PART DATA
        console.log(`[Đồng bộ Shelby] Bước 4: Đẩy dữ liệu (Part 0)...`);
        const partResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: {
                ...HEADERS,
                'Content-Type': 'application/octet-stream'
            },
            body: data
        });

        if (!partResponse.ok) {
            const partError = await partResponse.text();
            throw new Error(`Part Fail: ${partResponse.status} - ${partError}`);
        }

        // 3. COMPLETE UPLOAD
        console.log(`[Đồng bộ Shelby] Bước 5: Hoàn tất (Part 0)...`);
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                partIdentifiers: [{ partNumber: 0 }]
            })
        });

        if (!finalizeResponse.ok) {
            const finalError = await finalizeResponse.text();
            throw new Error(`Complete Fail: ${finalizeResponse.status} - ${finalError}`);
        }

        console.log(`[Đồng bộ Shelby] ĐỒNG BỘ THÀNH CÔNG RỰC RỠ! 🚀`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby v2.18]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}