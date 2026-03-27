import {
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET ULTIMATE PRODUCTION STABILIZATION (v2.14) ---
/**
 * ROBUST MANUAL NATIVE SYNC: Added ID validation and debug logs 
 * to prevent the "undefined" upload ID error reported in network logs.
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

        console.log(`[Đồng bộ Shelby] Đang mã hóa ${fileName}...`);
        const arrayBuffer = await imageBlob.arrayBuffer();
        data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Đồng bộ Shelby] Đăng ký trên chuỗi Shelbynet...`);
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

        console.log(`[Đồng bộ Shelby] Chờ xác nhận giao dịch...`);
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });

        console.log(`[Đồng bộ Shelby] Khởi tạo phiên tải lên tại ${SHELBY_STORAGE_RPC}...`);

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
            throw new Error(`Khởi tạo thất bại: ${initResponse.status} - ${body}`);
        }

        const uploadInfo = await initResponse.json();
        // Support both snake_case (standard) and camelCase (potential variation)
        const uploadId = uploadInfo.upload_id || uploadInfo.uploadId;

        console.log(`[Đồng bộ Shelby] ID phiên: ${uploadId}`);

        if (!uploadId || uploadId === "undefined") {
            throw new Error("Lỗi hệ thống: Không lấy được Upload ID hợp lệ từ máy chủ Shelby.");
        }

        // 2. UPLOAD PART DATA
        console.log(`[Đồng bộ Shelby] Đang đẩy dữ liệu (${uploadId})...`);
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
            throw new Error(`Lỗi tải dữ liệu: ${partResponse.status} - ${partError}`);
        }

        // 3. COMPLETE UPLOAD
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                partIdentifiers: [{ partNumber: 1 }]
            })
        });

        if (!finalizeResponse.ok) throw new Error("Lỗi hoàn thiện dữ liệu trên Shelby");

        console.log(`[Đồng bộ Shelby] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby v2.14]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}