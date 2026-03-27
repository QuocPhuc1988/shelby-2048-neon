import {
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET ABSOLUTE GOLDEN REFINERY (v2.20) ---
/**
 * MISSION ACCOMPLISHED: Final refinement of Identity, Naming, and Synchronization.
 * Implements "lau bảng" logic and shortened wallet identification.
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

/**
 * Shortens wallet address for clear identity (0x1234...abcd)
 */
const shortenAddress = (addr: string) => {
    if (!addr) return "Unknown";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

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
        // --- FINALIZED NAMING LOGIC (v2.20) ---
        // 1. Priority: Nickname -> 2. Shortened Wallet -> 3. Fallback
        const hasNick = nickname && nickname.trim() !== "" && nickname !== 'Anony_Shelby';
        const displayPlayer = hasNick ? nickname!.trim() : shortenAddress(accountAddress);

        // Clean name and format as 2048_Shelby_[ID]_[SCORE]
        const cleanName = displayPlayer.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        fileName = `2048_Shelby_${cleanName}_${score}.${format}`;

        console.log(`[Đồng bộ Shelby] Final Identity: ${cleanName}`);

        const arrayBuffer = await imageBlob.arrayBuffer();
        data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Đồng bộ Shelby] Gửi giao dịch chuỗi...`);
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
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });

        console.log(`[Đồng bộ Shelby] Khởi tạo Upload: ${fileName}`);

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

        if (!uploadId) throw new Error("Không thể trích xuất Upload ID hợp lệ.");

        // 2. UPLOAD PART DATA (0-indexed)
        console.log(`[Đồng bộ Shelby] Đẩy dữ liệu lên Shelby...`);
        const partResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/parts/0`, {
            method: 'PUT',
            headers: { ...HEADERS, 'Content-Type': 'application/octet-stream' },
            body: imageBlob
        });

        if (!partResponse.ok) throw new Error("Lỗi tải phần dữ liệu.");

        // 3. COMPLETE UPLOAD
        const finalizeResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads/${uploadId}/complete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ partIdentifiers: [{ partNumber: 0 }] })
        });

        if (!finalizeResponse.ok) throw new Error("Lỗi hoàn tất upload.");

        console.log(`[Đồng bộ Shelby] ĐỒNG BỘ THÀNH CÔNG RỰC RỠ! 🚀`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Shelby v2.20 Error]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}