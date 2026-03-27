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

30: export async function submitVerifiedPicture(
31: signAndSubmitTransaction: any,
32: accountAddress: string,
33: nickname: string | null,
34: score: number,
35: imageBlob: Blob
36: ) {
    37: try {
        38:         // NÂNG CẤP: KHÓA TÊN FILE NGAY TỪ ĐẦU (Đảm bảo On-chain & Off-chain sinh đôi cùng trứng)
        39: const playerTag = nickname || `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`;
        40: const finalFileName = `2048_Shelby_${playerTag.replace(/[^a-z0-9]/gi, '_')}_${score}.png`;
        41:
        42: const arrayBuffer = await imageBlob.arrayBuffer();
        43: const data = new Uint8Array(arrayBuffer);
        44: const cleanSize = Number(data.length);
        45:
        46: if (isNaN(cleanSize) || cleanSize <= 0) {
            47: throw new Error("LỖI LOGIC: Kích thước ảnh không xác định (NaN)");
            48:
        }
        49:
        50: const provider = await createDefaultErasureCodingProvider();
        51: const commitments = await generateCommitments(provider, data);
        52: const totalParts = expectedTotalChunksets(commitments.raw_data_size);
        53:
        54:         // 1. REGISTER METADATA (Dùng finalFileName)
        55: const payload = ShelbyBlobClient.createRegisterBlobPayload({
            56: account: AccountAddress.from(accountAddress),
            57: blobName: finalFileName,
            58: blobMerkleRoot: commitments.blob_merkle_root,
            59: numChunksets: totalParts,
            60: expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            61: blobSize: Number(commitments.raw_data_size),
            62: encoding: 0,
            63:         });
    64:
    65: console.log(`[Ledger] Registering blob: ${finalFileName}`);
    66: const tx = await signAndSubmitTransaction({ data: payload });
    67: await aptosClient.waitForTransaction({ transactionHash: tx.hash });
    68:
    69:         // 2. INITIALIZING UPLOAD (Dùng finalFileName + Ép kiểu sạch)
    70: console.log(`[Storage] Xin mã vận đơn cho: ${finalFileName} (${cleanSize} bytes)`);
    71: const initResponse = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
        72: method: 'POST',
        73: headers: HEADERS,
        74: body: JSON.stringify({
            75: rawAccount: accountAddress,
            76: rawBlobName: finalFileName,
            77: partSize: cleanSize,
            78: rawBlobSize: cleanSize,
            79: rawPartSize: cleanSize,
            80: blobSize: cleanSize
81:             })
82:         });

    const resData = await initResponse.json();

    // --- ĐOẠN FIX CHÍ MẠNG Ở ĐÂY ---
    // Bắt ID (CamelCase như log đã báo)
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
