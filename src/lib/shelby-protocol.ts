import {
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET ULTIMATE PRODUCTION STABILIZATION (v2.13) ---
/**
 * 100% MANUAL NATIVE SYNC: Bypasses SDK defaults to kill background leaks.
 * Source: Geomi/Shelby standard for bot keys (x-api-key).
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

        console.log(`[Đồng bộ Shelby] Bắt tay thủ công với cổng Shelbynet...`);

        /**
         * DEFINITIVE MANUAL SYNC FLOW (Bypasses SDK Initiator leaks)
         * 1. Initiate Multipart Upload via direct fetch
         */
        const initResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                rawAccount: accountAddress,
                rawBlobName: fileName,
                rawPartSize: data.length // Single part for optimized speed
            })
        });

        if (!initResponse.ok) {
            const body = await initResponse.text();
            throw new Error(`Xác thực thất bại (401): Shelby từ chối mã khóa. [${body}]`);
        }

        const uploadInfo = await initResponse.json();
        const uploadId = uploadInfo.upload_id;

        console.log(`[Đồng bộ Shelby] Đang đẩy dữ liệu (${uploadId})...`);

        /**
         * 2. Upload part data (Bypasses SDK putBlob)
         */
        const partResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/1`, {
            method: 'PUT',
            headers: {
                ...HEADERS,
                'Content-Type': 'application/octet-stream'
            },
            body: data
        });

        if (!partResponse.ok) throw new Error("Lỗi tải một phần dữ liệu");

        /**
         * 3. Complete Upload
         */
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                partIdentifiers: [{ partNumber: 1 }]
            })
        });

        if (!finalizeResponse.ok) throw new Error("Lỗi hoàn thiện dữ liệu");

        console.log(`[Đồng bộ Shelby] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}