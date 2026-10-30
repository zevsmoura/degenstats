import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { calculateTokenPerformance } from "@/lib/analytics/pnl";
import { fetchAllTransactions, WalletAnalysisError } from "@/lib/helius/client";
import { isValidSolanaAddress } from "@/lib/solana/address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getWalletAnalysis = unstable_cache(
  async (address: string) => {
    const history = await fetchAllTransactions(address);
    if (history.length === 0) {
      return { address, status: "empty", transactionCount: 0, tokens: [], message: "No transaction history found for this wallet." };
    }

    const swaps = history.filter((transaction) => transaction.type?.toUpperCase() === "SWAP");
    if (swaps.length === 0) {
      return { address, status: "no-swaps", transactionCount: history.length, tokens: [], swapCount: 0 };
    }

    const tokens = calculateTokenPerformance(address, history);
    return {
      address,
      status: tokens.length > 0 ? "ok" : "no-swaps",
      transactionCount: history.length,
      swapCount: swaps.length,
      tokens,
      caveats: [
        "P&L uses FIFO cost basis and excludes network and protocol fees.",
        "USD P&L is available only when Helius reports a USDC or USDT swap leg; no historical SOL/USD price is inferred.",
        "Tokens received by transfer are tracked with unknown cost basis and can make later realized P&L incomplete.",
        "Wrapped SOL is treated as SOL quote currency, not a tradeable token.",
      ],
    };
  },
  ["degenstats-wallet-analysis-v1"],
  { revalidate: 600 },
);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a Solana wallet address." }, { status: 400 });
  }

  const address = typeof body === "object" && body !== null && "address" in body && typeof body.address === "string"
    ? body.address.trim()
    : "";

  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ error: "That doesn’t look like a valid Solana public address." }, { status: 400 });
  }

  try {
    const result = await getWalletAnalysis(address);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WalletAnalysisError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Couldn’t analyze that wallet right now. Try again shortly." }, { status: 502 });
  }
}
