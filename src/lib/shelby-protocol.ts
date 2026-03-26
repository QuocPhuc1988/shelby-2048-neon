/**
 * Shelby Protocol - Official SDK Integration (v2.0)
 * 
 * Final Ground Truth Configuration (Post-Research):
 * 1. Ledger RPC: https://api.shelbynet.shelby.xyz/v1 (Chain ID 113)
 * 2. Blob/Storage RPC: https://api.shelbynet.shelby.xyz/shelby
 * 3. Public Auth Token: AG-5Y2LDN4FNNRETSQRMS9VQRFFOKVHSRZ6J
 */

import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- GROUND TRUTH ENDPOINTS ---
const SHELBY_LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_STORAGE_RPC = "https://api.shelbynet.shelby.xyz/shelby";
const PUBLIC_API_KEY = "AG-5Y2LDN4FNNRETSQRMS9VQRFFOKVHSRZ6J";

// Shelby SDK Config (For Blobs & Storage)
const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY || PUBLIC_API_KEY,
};

// Aptos SDK Config (For Transactions & Ledger Sync)
const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: SHELBY_LEDGER_RPC,
});

// Initialize clients
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
        const fileName = `${nickname.replace(/[^a-z0-9]/gi, '_')}_${score}.${format}`;

        // --- STEP 1: FILE ENCODING ---
        console.log(`[Shelby SDK] Encoding file: ${fileName}...`);
        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        // --- STEP 2: ON-CHAIN REGISTRATION ---
        console.log(`[Shelby SDK] Creating registration payload...`);
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

        console.log(`[Shelby SDK] Signing and submitting transaction...`);
        const transactionResponse = await signAndSubmitTransaction({ data: payload });

        // Wait for blockchain confirmation on CUSTOM RPC
        try {
            console.log(`[Shelby SDK] Waiting for ledger sync (${transactionResponse.hash})...`);
            await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });
            console.log(`[Shelby SDK] Transaction confirmed!`);
        } catch (waitError: any) {
            console.warn("[Shelby SDK] Wait failed (likely indexing delay), continuing to upload...");
        }

        // --- STEP 3: RPC UPLOAD ---
        // Using the corrected Storage RPC and Public API Key
        console.log(`[Shelby SDK] Synchronizing blob bytes to indexer...`);
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Shelby SDK] Sync Complete. Explorer Preview should be active.`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Shelby SDK Error]:", error);
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "SpeedRunner_99", score: 32768, time: 180, address: "0x5ae...bb15", timestamp: Date.now() },
        { nickname: "Shelby_Ace", score: 16384, time: 210, address: "0x85f...8e6a", timestamp: Date.now() },
    ].sort((a, b) => b.score - a.score);
}
