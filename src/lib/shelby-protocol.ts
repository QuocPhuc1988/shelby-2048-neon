import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET PRODUCTION ALIGNMENT (FORCE) ---
/**
 * CRITICAL: We override any ENV configured endpoints with the 
 * verified production Shelbynet RPCs to resolve "wrong authority" errors.
 */
const SHELBY_LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_STORAGE_RPC = "https://api.shelbynet.shelby.xyz/shelby";

// Authentication Normalization (Prefix-Agnostic)
const getCleanApiKey = () => {
    const raw = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
    // Strip "Bearer " or "bearer " if it exists to prevent duplication
    return raw.replace(/^bearer\s+/i, "").trim();
};

const RAW_KEY = getCleanApiKey();
if (!RAW_KEY) {
    console.error("LỖI NGHIÊM TRỌNG: Không tìm thấy khóa xác thực (API Key)!");
}

// Format exactly once as "Bearer <key>"
const FORMATTED_AUTH_HEADER = `Bearer ${RAW_KEY}`;

// Shelby SDK Config
const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: RAW_KEY, // The SDK usually adds Bearer itself
    headers: {
        'Authorization': FORMATTED_AUTH_HEADER, // Double check
        'x-api-key': RAW_KEY
    }
};

// Aptos SDK Config
const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: SHELBY_LEDGER_RPC,
});

const shelbyClient = new ShelbyClient(shelbyConfig);
const aptosClient = new Aptos(aptosConfig);

export async function submitVerifiedPicture(
    signAndSubmitTransaction: any,
    accountAddress: string,
    nickname: string,
    score: number,
    imageBlob: Blob,
    format: 'png' | 'jpg'
) {
    try {
        const fileName = `${nickname.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}_${score}.${format}`;

        console.log(`[Đồng bộ Shelby] Đang mã hóa ${fileName}...`);
        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Đồng bộ Shelby] Đăng ký trên chuỗi ID 113...`);
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

        console.log(`[Đồng bộ Shelby] Đang chờ xác nhận giao dịch...`);
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });

        console.log(`[Đồng bộ Shelby] Đang đẩy dữ liệu vào kho: ${SHELBY_STORAGE_RPC}`);

        // Use SDK for part upload
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Đồng bộ Shelby] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby]:", error);

        // Fallback: If SDK fails with 401, try a manual fetch handshake exactly as Explorer does.
        if (error.status === 401 || error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            console.warn("[Đồng bộ Shelby] Thử nghiệm phương thức bắt tay thủ công (Bearer Fix)...");
            const response = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': FORMATTED_AUTH_HEADER
                },
                body: JSON.stringify({
                    rawAccount: accountAddress,
                    rawBlobName: fileName,
                    rawPartSize: 5242880
                })
            });
            if (response.ok) {
                console.log("[Đồng bộ Shelby] Bắt tay thủ công THÀNH CÔNG!");
                // Manual upload of parts would go here if needed, but the 401 happens at handshake.
            } else {
                const body = await response.text();
                throw new Error(`Lỗi 401: Khóa xác thực bị từ chối (${body}). Kiểm tra lại Vercel Env Vars.`);
            }
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "Player_1", score: 2048, time: 100, address: "0x123", timestamp: Date.now() }
    ];
}