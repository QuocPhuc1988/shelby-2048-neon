import {
    ShelbyClient,
    ShelbyBlobClient,
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets
} from "@shelby-protocol/sdk/browser";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";

const SHELBY_LEDGER_RPC = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_STORAGE_RPC = "https://api.shelbynet.shelby.xyz/shelby"; 

const RAW_API_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY || "";

if (!RAW_API_KEY) {
    console.error("LOI NGHIEM TRONG: Khong tim thay khoa xac thuc tren he thong!");
}

const FORMATTED_API_KEY = RAW_API_KEY.startsWith('Bearer') 
    ? RAW_API_KEY 
    : `Bearer ${RAW_API_KEY}`;

const shelbyConfig: any = {
    network: Network.TESTNET,
    rpcUrl: SHELBY_STORAGE_RPC,
    apiKey: FORMATTED_API_KEY,
    headers: {
        'Authorization': FORMATTED_API_KEY,
        'x-api-key': RAW_API_KEY
    }
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

        console.log(`[Dong bo Shelby] Dang ma hoa ${fileName}...`);
        const arrayBuffer = await imageBlob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const provider = await createDefaultErasureCodingProvider();
        const commitments = await generateCommitments(provider, data);

        console.log(`[Dong bo Shelby] Dang ky tren chuoi ID 113...`);
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

        console.log(`[Dong bo Shelby] Dang cho xac nhan giao dich...`);
        await aptosClient.waitForTransaction({ transactionHash: transactionResponse.hash });
        
        console.log(`[Dong bo Shelby] Dang day du lieu vao kho: ${SHELBY_STORAGE_RPC}`);
        await shelbyClient.rpc.putBlob({
            account: AccountAddress.from(accountAddress),
            blobName: fileName,
            blobData: data,
        });

        console.log(`[Dong bo Shelby] Thanh cong ruc ro!`);
        return transactionResponse;
    } catch (error: any) {
        console.error("[Chi tiet loi Shelby]:", error);
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            throw new Error("Loi 401: Khoa xac thuc bi tu choi. Vui long kiem tra lai he thong.");
        }
        throw error;
    }
}

export async function fetchLeaderboard() {
    return [
        { nickname: "Player_1", score: 2048, time: 100, address: "0x123", timestamp: Date.now() }
    ];
}
