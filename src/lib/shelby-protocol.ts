import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET PRODUCTION CONSOLIDATION (v2.11) ---
/**
 * All legacy "api.testnet" references have been purged. 
 * We now strictly use the professional Shelbynet infrastructure.
 */
const SHELBY_RPC_ROOT = "https://api.shelbynet.shelby.xyz";
const SHELBY_LEDGER_RPC = `${SHELBY_RPC_ROOT}/v1`;
const SHELBY_STORAGE_RPC = `${SHELBY_RPC_ROOT}/shelby`;

// Authentication Normalization (The Definitive Standard)
const getCleanApiKey = () => {
    const raw = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
    // Ensure we send only the raw key string to the gateway
    return raw.replace(/^bearer\s+/i, "").trim();
};

const RAW_KEY = getCleanApiKey();

const HEADERS = {
    'x-api-key': RAW_KEY,
    'Content-Type': 'application/json'
};

// Shelby SDK Config
const shelbyConfig: any = {
    // We set network to TESTNET as the SDK requires an enum, 
    // but we override the URL to hit Shelbynet.
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: RAW_KEY,
    headers: HEADERS
};

// Aptos SDK Config (v5.2.1 Pinned)
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

        console.log(`[Đồng bộ Shelby] Đang đẩy dữ liệu vào kho...`);

        // Use SDK putBlob with reinforced headers
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Đồng bộ Shelby] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby]:", error);

        // Manual recovery handshake (Primary mode in v2.11+)
        if (error.status === 401 || error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            console.warn("[Đồng bộ Shelby] Đang thử phương thức bắt tay tối ưu (x-api-key)...");
            const response = await fetch(`${SHELBY_STORAGE_RPC}/v1/multipart-uploads`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    rawAccount: accountAddress,
                    rawBlobName: fileName,
                    rawPartSize: 5242880
                })
            });
            if (response.ok) {
                console.log("[Đồng bộ Shelby] Bắt tay thủ công THÀNH CÔNG!");
            } else {
                throw new Error("LỖI XÁC THỰC: Shelby từ chối mã khóa. Kiểm tra biến NEXT_PUBLIC_SHELBY_API_KEY.");
            }
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}