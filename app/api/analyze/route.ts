import { NextResponse } from "next/server";
import { calculateTokenPerformance } from "@/lib/analytics/pnl";
import { fetchAllTransactions, WalletAnalysisError } from "@/lib/helius/client";
import { isValidSolanaAddress } from "@/lib/solana/address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const analysisCache = new Map<string, { expiresAt: number; value: Record<string, unknown> }>();

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

  const cached = analysisCache.get(address);
  if (cached && cached.expiresAt > Date.now()) {
    analysisCache.delete(address);
    analysisCache.set(address, cached);
    return NextResponse.json(cached.value, { headers: { "x-analysis-cache": "hit" } });
  }
  if (cached) analysisCache.delete(address);

  try {
    const history = await fetchAllTransactions(address);
    if (history.length === 0) {
      return cacheAndRespond(address, { address, status: "empty", transactionCount: 0, tokens: [], message: "No transaction history found for this wallet." });
    }

    const swaps = history.filter((transaction) => transaction.type?.toUpperCase() === "SWAP");
    if (swaps.length === 0) {
      return cacheAndRespond(address, { address, status: "no-swaps", transactionCount: history.length, tokens: [], swapCount: 0 });
    }

    const tokens = calculateTokenPerformance(address, history);
    return cacheAndRespond(address, {
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
    });
  } catch (error) {
    if (error instanceof WalletAnalysisError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Couldn’t analyze that wallet right now. Try again shortly." }, { status: 502 });
  }
}

function cacheAndRespond(address: string, value: Record<string, unknown>) {
  analysisCache.set(address, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (analysisCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = analysisCache.keys().next().value;
    if (!oldestKey) break;
    analysisCache.delete(oldestKey);
  }
  return NextResponse.json(value, { headers: { "x-analysis-cache": "miss" } });
}
