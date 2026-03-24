import { GameData } from "./shelby";

/**
 * Shelby Protocol Implementation
 * Specifically designed to match the user's mandatory technical requirements:
 * 1. Backticks for module interpolation.
 * 2. Uint8Array for p3 (Data Commitment).
 * 3. Modern AIP-62 (Wallet Standard) format for Petra compatibility.
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

        // 2. p3 Data Commitment as Uint8Array (Required by user)
        const p3 = new Uint8Array(32);
        const scoreVal = gameData.score;
        for (let i = 0; i < 32; i++) {
            p3[i] = (scoreVal ^ i) & 0xFF;
        }

        // 3. Prepare arguments using Modern AIP-62 (Wallet Standard) format
        // This fixes the "Cannot use 'in' operator" error in modern Petra wallet
        const payload = {
            data: {
                function: SHELBY_MODULE,
                typeArguments: [],
                functionArguments: [
                    "2048_SHELBY_RECORD",                   // p1: Name
                    `Score: ${gameData.score}`,             // p2: Description
                    Array.from(p3),                         // p3: Uint8Array as array
                    gameData.score.toString(),              // p4: Size (mocked as score)
                    "application/json",                     // p5: Content Type
                    Array.from(p3).reverse(),               // p6: Hash (mocked)
                    accountAddress                          // p7: Submitter Address
                ],
            }
        };

        console.log("[Shelby] Submitting Transaction (AIP-62):", payload);

        const response = await signAndSubmitTransaction(payload);
        return response;
    } catch (error) {
        console.error("[Shelby] Transaction Failed:", error);
        throw error;
    }
}
