import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- SHELBYNET PRODUCTION ALIGNMENT ---
const SHELBY_LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_STORAGE_RPC = "https://api.shelbynet.shelby.xyz/shelby";

// Authentication Normalization (The DEFINITIVE Fix)
const getCleanApiKey = () => {
    const raw = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
    // Strip prefixes to get the raw "bot_..." key string
    return raw.replace(/^bearer\s+/i, "").trim();
};

const RAW_KEY = getCleanApiKey();

/**
 * CRITICAL RESEARCH FINDING: 
 * Shelby "Bot" keys starting with 'bot_' require the 'x-api-key' header 
 * for successful storage uploads, rather than 'Authorization: Bearer'.
 */
const HEADERS = {
    'x-api-key': RAW_KEY,
    'Content-Type': 'application/json'
};

// Shelby SDK Config
const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: RAW_KEY,
    headers: HEADERS // Inject correct Geomi headers
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

        console.log(`[Đồng bộ Shelby] Đang đẩy dữ liệu vào kho...`);

        // Finalized PUT with x-api-key reinforcement
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Đồng bộ Shelby] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby]:", error);

        // DEFINITIVE Manual Check (x-api-key)
        if (error.status === 401 || error.message?.includes("401")) {
            console.warn("[Đồng bộ Shelby] Thử nghiệm bắt tay thủ công (Hệ chuẩn x-api-key)...");
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
                throw new Error("LỖI 401: Shelby từ chối khóa xác thực. Hãy chắc chắn biến môi trường tên là NEXT_PUBLIC_SHELBY_API_KEY.");
            }
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [];
}