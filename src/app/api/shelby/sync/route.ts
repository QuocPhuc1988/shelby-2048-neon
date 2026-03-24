import { NextRequest, NextResponse } from "next/server";

// This is a proxy to the actual Shelby Protocol Node / SDK
// In a real scenario, this would use the SHELBY_API_KEY from .env.local 
// and call the register_blob / get_blob functions via Aptos SDK or Shelby REST API.

export async function POST(req: NextRequest) {
    try {
        const { address, data } = await req.json();

        // SECURITY: Here you would verify the signature if passed from client
        console.log(`[Shelby Proxy] Saving data for ${address}:`, data);

        // Mocking Shelby API Call
        // const shelbyApiKey = process.env.SHELBY_API_KEY;
        // const response = await fetch(`${process.env.SHELBY_ENDPOINT}/data`, { ... });

        return NextResponse.json({ success: true, txHash: "0x..." });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Sync failed" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const address = req.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });

    console.log(`[Shelby Proxy] Fetching latest state for ${address}`);

    // Mocking Shelby Retrieval
    // Return null if no data found
    return NextResponse.json(null);
}
