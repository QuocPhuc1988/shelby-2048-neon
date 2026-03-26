/**
 * Shelby Protocol - Official SDK Integration (v2.0)
 * 
 * This implementation follows the official 'Uploading a File' guide:
 * https://docs.shelby.xyz/sdks/typescript/browser/guides/upload
 * 
 * Flow:
 * 1. File Encoding (Clay n=16 k=10)
 * 2. On-Chain Metadata Registration (register_blob via SDK payload)
 * 3. RPC Multipart Upload (putBlob)
 */

import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

// Client Configuration
const config: any = {
    network: Network.TESTNET,
    apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY || "shelbynet_free_access", // Optional API Key
};

// Initialize clients
const shelbyClient = new ShelbyClient(config);
const aptosClient = new Aptos(new AptosConfig({ network: Network.TESTNET }));

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

        // Use default Clay (n=16, k=10) provider
        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        // --- STEP 2: ON-CHAIN REGISTRATION ---
        console.log(`[Shelby SDK] Creating registration payload...`);
        const expirationMicros = (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000; // 30 days

        const payload = ShelbyBlobClient.createRegisterBlobPayload({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobMerkleRoot: commitments.blob_merkle_root,
            numChunksets: expectedTotalChunksets(commitments.raw_data_size),
            expirationMicros: expirationMicros,
            blobSize: commitments.raw_data_size,
            encoding: 0, // 0 = Clay (standard)
        });

        // Use the wallet to sign and submit
        console.log(`[Shelby SDK] Signing and submitting transaction...`);
        const transactionResponse = await signAndSubmitTransaction({ data: payload });

        // Wait for blockchain confirmation
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });
        console.log(`[Shelby SDK] Transaction confirmed: ${transactionResponse.hash}`);

        // --- STEP 3: RPC UPLOAD ---
        console.log(`[Shelby SDK] Uploading blob bytes via RPC...`);
        await shelbyClient.rpc.putBlob({
            account: transactionResponse.sender, // The andress from the tx response
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Shelby SDK] Sync Complete. Explorer Preview and Status should be Available.`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Shelby SDK Error]:", error);
        throw error;
    }
}

/**
 * Mock Leaderboard (Replace with an indexer query in production)
 */
export async function fetchLeaderboard() {
    return [
        { nickname: "SpeedRunner_99", score: 32768, time: 180, address: "0x5ae...bb15", timestamp: Date.now() },
        { nickname: "Shelby_Ace", score: 16384, time: 210, address: "0x85f...8e6a", timestamp: Date.now() },
    ].sort((a, b) => b.score - a.score);
}
