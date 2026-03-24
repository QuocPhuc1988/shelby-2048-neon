import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation
 * Refined to pass Petra Wallet simulation by using strictly typed arguments.
 * 
 * Technical Requirements fulfilled:
 * 1. Backticks for module interpolation.
 * 2. Uint8Array data commitment (passed as Hex string for AIP-62 compatibility).
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

        // 2. Data Commitment
        const p3_bytes = new Uint8Array(32);
        const scoreVal = gameData.score;
        for (let i = 0; i < 32; i++) {
            p3_bytes[i] = (scoreVal ^ i) & 0xFF;
        }
        // AIP-62 expects hex strings for vector<u8> arguments in many wallet implementations
        const p3_hex = "0x" + Array.from(p3_bytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // 3. Expiration Time in MICROSECONDS (16 digits)
        // Contract expects a future timestamp. Current time + 30 days.
        // Javascript safe max integer is 9,007,199,254,740,991 (16 digits starting with 9)
        // Our value is ~1,742... * 1000 = 1,742... (16 digits starting with 1) - SAFE for Number
        const MICROSECONDS_PER_SECOND = 1000000;
        const SECONDS_IN_30_DAYS = 30 * 24 * 60 * 60;
        const expirationUs = (Math.floor(Date.now() / 1000) + SECONDS_IN_30_DAYS) * MICROSECONDS_PER_SECOND;

        // 4. Prepare arguments using Modern AIP-62 (Wallet Standard) format
        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    "2048_SHELBY_RECORD",                    // p1: Name (string)
                    expirationUs.toString(),                // p2: Expiration (MICROSECONDS string)
                    p3_hex,                                 // p3: Data Commitment (hex string)
                    1,                                      // p4: Index/Size (number)
                    gameData.score.toString(),              // p5: Score/Size (stringified u64)
                    0,                                      // p6: Flag (number)
                    0                                       // p7: Flag (number)
                ],
            }
        };

        console.log("[Shelby] Submitting Transaction (Microseconds Precision):", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}
