import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation
 * Specifically aligned with the user's "Hand-holding" (Cầm tay chỉ việc) parameters:
 * 1. p1 (string): Name
 * 2. p2 (u64): Expiration in MICROSECONDS (16 digits)
 * 3. p3 (vector<u8>): Commitment (32 zero bytes for registration)
 * 4. p4 (u32): Chunkset quantity (default 1)
 * 5. p5 (u64): Data size in bytes
 * 6. p6 (u8): Payment Tier
 * 7. p7 (u8): Encoding
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

        // 2. Data Commitment - Use 32 Zero Bytes for simplified registration
        // As per user: "Khi dùng CLI, ông có thể để chuỗi 32 bytes zero nếu chỉ muốn đăng ký vị trí."
        const p3_zeros = new Uint8Array(32); // Automatically initialized to zeros

        // 3. Expiration Time in MICROSECONDS (16 digits)
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
                    expirationUs.toString(),                // p2: Expiration (u64 string)
                    Array.from(p3_zeros),                    // p3: Commitment (32 zero bytes)
                    1,                                      // p4: Chunkset Qty (u32)
                    gameData.score.toString(),              // p5: File Size (u64 string)
                    0,                                      // p6: Payment Tier (u8)
                    0                                       // p7: Encoding (u8)
                ],
            }
        };

        console.log("[Shelby] Submitting Transaction (Aligned with CLI defaults):", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}
