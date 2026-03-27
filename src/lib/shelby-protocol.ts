import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

const SHELBY_RPC = "https://api.shelbynet.shelby.xyz/shelby";
const LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";

const RAW_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";
// Gỡ sạch rác Bearer nếu có
const CLEAN_KEY = RAW_KEY.replace(/^Bearer\s+/i, "").trim();

const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_RPC,
    apiKey: `Bearer ${CLEAN_KEY}`, 
};

const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: LEDGER_RPC,
});

const shelbyClient = new ShelbyClient(shelbyConfig);
const aptosClient = new Aptos(aptosConfig);

export async function submitVerifiedPicture(
    signAndSubmitTransaction: any,
    accountAddress: string,
    nickname: string | null,
    score: number,
    imageBlob: Blob
) {
    try {
        // Tạo tên file: Ưu tiên Nickname -> Ví -> Mặc định
        const playerTag = nickname || `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`;
        const fileName = `2048_Shelby_${playerTag.replace(/[^a-z0-9]/gi, '_')}_${score}.png`;

        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);
        const totalParts = expectedTotalChunksets(commitments.raw_data_size);

        // BƯỚC 1: Đăng ký Metadata (Ví sẽ hiện popup xác nhận)
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: totalParts,
            expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
            blobSize: commitments.raw_data_size,
            encoding: 0,
        });

        const tx = await signAndSubmitTransaction({ data: payload });
        await aptosClient.waitForTransaction({ transactionHash: tx.hash });

        // BƯỚC 2: Đẩy ảnh thật vào kho (Dùng Index 0 như đã phân tích)
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        return tx;
    } catch (error: any) {
        console.error("[Shelby Error]:", error);
        throw error;
    }
}
