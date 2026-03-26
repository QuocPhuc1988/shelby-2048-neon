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

// Authentication Normalization
const RAW_API_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";

if (!RAW_API_KEY) {
    console.error("LỖI NGHIÊM TRỌNG: Không tìm thấy khóa xác thực (API Key) trên hệ thống!");
}

const FORMATTED_API_KEY = RAW_API_KEY.startsWith('Bearer')
    ? RAW_API_KEY
    : `Bearer ${RAW_API_KEY}`;

// Shelby SDK Config
const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: FORMATTED_API_KEY,
    headers: {
        'Authorization': FORMATTED_API_KEY,
        'x-api-key': RAW_API_KEY
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
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Đồng bộ Shelby] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiết lỗi Shelby]:", error);
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            throw new Error("Lỗi 401: Khóa xác thực bị từ chối. Vui lòng kiểm tra lại hệ thống (Vercel Env Vars).");
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "Player_1", score: 2048, time: 100, address: "0x123", timestamp: Date.now() }
    ];
}