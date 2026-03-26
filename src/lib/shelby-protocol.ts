/**
 * Shelby Protocol - Official SDK Integration (v2.1)
 */

import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- CẤU HÌNH ĐÃ ĐƯỢC CĂN CHỈNH ---
// --- SỬA LẠI ĐOẠN NÀY CHO ĐỒNG BỘ ---
const SHELBY_LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_STORAGE_RPC = "https://api.shelbynet.shelby.xyz/shelby"; // Phải dùng shelbynet mới khớp chìa khóa 

// LẤY CHÌA KHÓA TỪ VERCEL (Không dùng chìa khóa dự phòng bị hỏng)
const API_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY;

if (!API_KEY) {
    console.error("CRITICAL ERROR: Không tìm thấy NEXT_PUBLIC_SHELBY_API_KEY trên Vercel!");
}

const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: API_KEY, // Chỉ dùng chìa khóa từ biến môi trường
};

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

        console.log(`[Shelby Sync] Đang mã hóa ${fileName}...`);
        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Shelby Sync] Đăng ký trên chuỗi (Chain ID 113)...`);
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

        // Bước 1: Ký ví xác nhận (Ví sẽ hiện popup)
        const transactionResponse = await signAndSubmitTransaction({ data: payload });

        console.log(`[Shelby Sync] Đang chờ xác nhận giao dịch...`);
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });
        
        // Bước 2: Đẩy dữ liệu vào kho lưu trữ (Đây là chỗ hay lỗi 401)
        console.log(`[Shelby Sync] Đang đẩy dữ liệu vào kho: ${SHELBY_STORAGE_RPC}`);
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Shelby Sync] Thành công rực rỡ!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Shelby Error Detail]:", error);
        if (error.message?.includes("401")) {
            throw new Error("Lỗi 401: Chìa khóa API trên Vercel của ông bị sai hoặc chưa được kích hoạt.");
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "Player_1", score: 2048, time: 100, address: "0x123", timestamp: Date.now() }
    ];
}
