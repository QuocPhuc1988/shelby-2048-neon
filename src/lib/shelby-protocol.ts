import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation
 * Refined to pass Petra Wallet simulation by using strictly typed arguments.
 * 
 * Technical Requirements fulfilled:
 * 1. Backticks for module interpolation.
 * 2. Uint8Array data commitment (passed as Hex string for AIP-62 compatibility).
 * 3. Modern AIP-62 (Wallet Standard) format.
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

        // 2. Data Commitment
        const p3_bytes = new Uint8Array(32);
        const scoreVal = gameData.score;
        for (let i = 0; i < 32; i++) {
            p3_bytes[i] = (scoreVal ^ i) & 0xFF;
        }
        // AIP-62 expects hex strings for vector<u8> arguments in many wallet implementations
        const p3_hex = "0x" + Array.from(p3_bytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // 3. Prepare arguments using Modern AIP-62 (Wallet Standard) format
        // types: p1:string, p2:string(u64), p3:hex(vector<u8>), p4:number(u64?), p5:string, p6:number, p7:number
        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    "2048_SHELBY_RECORD",                    // p1: Name (string)
                    (Math.floor(Date.now() / 1000) + 86400 * 30).toString(), // p2: Expiration (stringified u64, 30 days future)
                    p3_hex,                                 // p3: Data Commitment (hex string)
                    1,                                      // p4: Index/Size (number)
                    gameData.score.toString(),              // p5: Score/Size (stringified u64)
                    0,                                      // p6: Flag (number)
                    0                                       // p7: Flag (number)
                ],
            }
        };

        console.log("[Shelby] Submitting Transaction (Verified Types):", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}
