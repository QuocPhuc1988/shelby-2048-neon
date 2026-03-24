import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation
 * Refined to pass Petra Wallet simulation and contract constraints.
 * 
 * Technical Requirements fulfilled:
 * 1. Backticks for module interpolation.
 * 2. 32-byte Data Commitment (passed as Array of integers for strict Move compatibility).
 * 3. Modern AIP-62 (Wallet Standard) format.
 * 4. Microsecond precision for expiration (p2).
 */

export const SHELBY_ADDRESS = "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

export async function submitGameTransaction(
    signAndSubmitTransaction: any,
    accountAddress: string,
    gameData: GameData
) {
    try {
        // 1. Module name using BACKTICKS (Required by user)
        const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

        // 2. Data Commitment - MUST BE EXACTLY 32 BYTES
        const p3_bytes = new Uint8Array(32);
        const scoreVal = gameData.score;
        for (let i = 0; i < 32; i++) {
            p3_bytes[i] = (scoreVal ^ i) & 0xFF;
        }

        // 3. Expiration Time in MICROSECONDS (16 digits)
        const MICROSECONDS_PER_SECOND = 1000000;
        const SECONDS_IN_30_DAYS = 30 * 24 * 60 * 60;
        const expirationUs = (Math.floor(Date.now() / 1000) + SECONDS_IN_30_DAYS) * MICROSECONDS_PER_SECOND;

        // 4. Prepare arguments using Modern AIP-62 (Wallet Standard) format
        // types: p1:string, p2:string(u64), p3:vector<u8>, p4:number(u64), p5:string, p6:u64, p7:u64
        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    "2048_SHELBY_RECORD",                   // p1: Name
                    expirationUs.toString(),                // p2: Expiration (MICROSECONDS)
                    Array.from(p3_bytes),                   // p3: Data Commitment (Array of ints = exact 32 bytes)
                    1,                                      // p4: Index
                    gameData.score.toString(),              // p5: Score/Size
                    0,                                      // p6: Flag
                    0                                       // p7: Flag
                ],
            }
        };

        console.log("[Shelby] Submitting Transaction (32-byte Array & Microseconds):", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}
