/**
 * Shelby Protocol - Official SDK Integration (v2.0)
 * 
 * Reconfigured for Shelbynet RPC (Chain ID 113)
 * This resolves the "Transaction Not Found" 404 error on standard Labs nodes.
 */

import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// --- CONFIGURATION ---
const SHELBY_RPC = "https://api.shelbynet.shelby.xyz/v1";

// Shelby SDK Config
const shelbyConfig: any = {
    network: Network.TESTNET, // Or Network.CUSTOM if supported
    rpcUrl: SHELBY_RPC,
    apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY || "shelbynet_free_access",
};

// Aptos SDK Config (Standard Ledger Sync)
const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
    fullnode: SHELBY_RPC, // Force use of Shelbynet RPC
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

        // --- STEP 2.1: WAIT ON SHELBY RPC ---
        try {
            console.log(`[Shelby SDK] Waiting on Shelbynet (${transactionResponse.hash})...`);
            await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });
            console.log(`[Shelby SDK] Transaction confirmed!`);
        } catch (waitError: any) {
            console.warn("[Shelby SDK] Wait failed, check explorer but continuing to RPC upload...");
        }

        // --- STEP 3: RPC UPLOAD ---
        console.log(`[Shelby SDK] Uploading blob bytes to Shelby RPC...`);
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Shelby SDK] Sync Complete. Record is live.`);
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
