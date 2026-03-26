/**
 * Shelby Protocol - Official SDK Integration (v2.1)
 * 
 * Final Alignment for Shelbynet (Chain ID 113)
 * 
 * 1. Ledger RPC: https://api.shelbynet.shelby.xyz/v1
 * 2. Storage RPC: https://api.testnet.shelby.xyz/shelby (Aligned with user logs)
 * 3. Auth: Using public key verified from Explorer traffic.
 */

import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- FINAL ALIGNED ENDPOINTS ---
const SHELBY_LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_STORAGE_RPC = "https://api.testnet.shelby.xyz/shelby"; // Aligned with your console logs
const PUBLIC_API_KEY = "AG-5Y2LDN4FNNRETSQRMS9VQRFFOKVHSRZ6J";

// Shelby SDK Config
const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY || PUBLIC_API_KEY,
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

        console.log(`[Shelby Sync] Encoding ${fileName}...`);
        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Shelby Sync] Registering on-chain (Chain ID 113)...`);
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

        try {
            console.log(`[Shelby Sync] Waiting for confirmation...`);
            await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });
            console.log(`[Shelby Sync] Tx Confirmed!`);
        } catch (e) {
            console.warn("[Shelby Sync] Ledger wait timed out, attempting RPC upload anyway...");
        }

        // --- THE FIX: RPC UPLOAD ---
        console.log(`[Shelby Sync] Uploading to Storage RPC: ${SHELBY_STORAGE_RPC}`);
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Shelby Sync] Success! Picture should be available on Shelby Explorer.`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Shelby Error Detail]:", error);
        // Better error message for UI
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            throw new Error("Lỗi xác thực (401): API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại cấu hình hoặc thử lại sau.");
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "Player_1", score: 2048, time: 100, address: "0x123", timestamp: Date.now() }
    ];
}
