import type { HeliusEnhancedTransaction } from "./types";

const PAGE_SIZE = 100;
const HISTORY_URL = "https://api.helius.xyz/v0/addresses";
const MIN_REQUEST_INTERVAL_MS = 700;
const MAX_RATE_LIMIT_RETRIES = 3;

// Keep requests made by the same warm serverless instance below Helius's free
// Enhanced API rate limit. Requests are still sequential across each wallet.
let nextRequestAt = 0;

export class WalletAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: "CONFIGURATION" | "RATE_LIMITED" | "UPSTREAM" | "INVALID_RESPONSE" | "PAGINATION",
    public readonly status = 502,
  ) {
    super(message);
    this.name = "WalletAnalysisError";
  }
}

export async function fetchAllTransactions(address: string): Promise<HeliusEnhancedTransaction[]> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new WalletAnalysisError("Helius is not configured. Add HELIUS_API_KEY to the server environment.", "CONFIGURATION", 503);
  }

  const transactions: HeliusEnhancedTransaction[] = [];
  const seenCursors = new Set<string>();
  let beforeSignature: string | undefined;

  for (;;) {
    const url = new URL(`${HISTORY_URL}/${encodeURIComponent(address)}/transactions`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("token-accounts", "balanceChanged");
    url.searchParams.set("sort-order", "desc");
    if (beforeSignature) url.searchParams.set("before-signature", beforeSignature);

    const response = await fetchPage(url);
    if (!response.ok) {
      throw new WalletAnalysisError(`Helius returned an error (${response.status}). Try again later.`, "UPSTREAM", 502);
    }

    let page: unknown;
    try {
      page = await response.json();
    } catch {
      throw new WalletAnalysisError("Helius returned an unreadable response.", "INVALID_RESPONSE", 502);
    }
    if (!Array.isArray(page)) {
      throw new WalletAnalysisError("Helius returned an unexpected response.", "INVALID_RESPONSE", 502);
    }
    if (page.length === 0) break;

    const validTransactions = page.filter(isEnhancedTransaction);
    if (validTransactions.length !== page.length) {
      throw new WalletAnalysisError("Helius returned incomplete transaction data.", "INVALID_RESPONSE", 502);
    }
    transactions.push(...validTransactions);

    const nextCursor = validTransactions[validTransactions.length - 1]?.signature;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new WalletAnalysisError("Helius pagination stopped unexpectedly.", "PAGINATION", 502);
    }
    seenCursors.add(nextCursor);
    beforeSignature = nextCursor;
  }

  return transactions;
}

async function fetchPage(url: URL): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    await waitForRequestSlot();

    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch {
      throw new WalletAnalysisError("Helius could not be reached. Try again in a moment.", "UPSTREAM", 502);
    }

    if (response.status !== 429) return response;

    if (attempt === MAX_RATE_LIMIT_RETRIES) {
      throw new WalletAnalysisError(
        "Helius is still limiting requests after automatic retries. Wait a minute and try again; if it keeps happening, check your Helius usage or free credits.",
        "RATE_LIMITED",
        429,
      );
    }

    const retryAfterMs = getRetryAfterMs(response.headers.get("retry-after"));
    const backoffMs = Math.min(8_000, 1_000 * 2 ** attempt);
    await delay(retryAfterMs ?? backoffMs);
  }

  throw new WalletAnalysisError("Helius is rate limiting requests. Try again shortly.", "RATE_LIMITED", 429);
}

async function waitForRequestSlot(): Promise<void> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextRequestAt);
  nextRequestAt = scheduledAt + MIN_REQUEST_INTERVAL_MS;
  if (scheduledAt > now) await delay(scheduledAt - now);
}

function getRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isEnhancedTransaction(value: unknown): value is HeliusEnhancedTransaction {
  return typeof value === "object" && value !== null &&
    "signature" in value && typeof value.signature === "string";
}
