import {
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET ULTIMATE PRODUCTION STABILIZATION (v2.15) ---
/**
 * VERBOSE MANUAL NATIVE SYNC: Full-trace logging for the uploadId handshake.
 * This identifies why the ID was "undefined" in previous attempts.
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
    nickname: string,
    score: number,
    imageBlob: Blob,
    format: 'png' | 'jpg'
) {
    let fileName = "";
    let data: Uint8Array = new Uint8Array();

    try {
        fileName = `${nickname.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}_${score}.${format}`;

        console.log(`[Đồng bộ Shelby] Bước 1: Mã hóa (${fileName})...`);
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

        console.log(`[Đồng bộ Shelby] Chờ xác nhận Giao dịch...`);
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });

        console.log(`[Đồng bộ Shelby] Bước 3: Khởi tạo Multipart Upload...`);

        // 1. INITIATE UPLOAD
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

        /** 
         * VERBOSE DEBUG: Log the full response to find the correct ID field.
         */
        console.log("[Đồng bộ Shelby] JSON Metadata:", JSON.stringify(uploadInfo));

        // Robust ID extraction mapping
        const uploadId =
            uploadInfo.upload_id ||
            uploadInfo.uploadId ||
            (uploadInfo.upload_info && uploadInfo.upload_info.upload_id) ||
            (uploadInfo.data && uploadInfo.data.upload_id);

        if (!uploadId || uploadId === "undefined") {
            console.error("[Đồng bộ Shelby] LỖI: Không tìm thấy Upload ID trong phản hồi JSON!");
            throw new Error("Lỗi hệ thống: Phản hồi từ Shelby không chứa Mã định danh Upload hợp lệ.");
        }

        console.log(`[Đồng bộ Shelby] ID phiên hợp lệ: ${uploadId}`);

        // 2. UPLOAD PART DATA
        console.log(`[Đồng bộ Shelby] Bước 4: Đẩy dữ liệu (PUT)...`);
        const partResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/1`, {
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
        console.log(`[Đồng bộ Shelby] Bước 5: Hoàn tất (Complete)...`);
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                partIdentifiers: [{ partNumber: 1 }]
            })
        });

        if (!finalizeResponse.ok) {
            const finalError = await finalizeResponse.text();
            throw new Error(`Complete Fail: ${finalizeResponse.status} - ${finalError}`);
        }

        console.log(`[Đồng bộ Shelby] ĐỒNG BỘ THÀNH CÔNG RỰC RỠ! 🚀`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby v2.15]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}