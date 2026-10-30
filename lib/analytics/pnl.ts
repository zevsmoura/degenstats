import type { HeliusEnhancedTransaction } from "@/lib/helius/types";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;
const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

export interface TokenPerformance {
  mint: string;
  totalBought: number;
  totalSold: number;
  realizedPnlSol: number;
  realizedPnlUsd: number | null;
  averageEntryPriceSol: number | null;
  averageEntryPriceUsd: number | null;
  averageExitPriceSol: number | null;
  averageExitPriceUsd: number | null;
  averageHoldSeconds: number | null;
  unpricedSoldQuantity: number;
  unpricedUsdSoldQuantity: number;
  pnlCompleteSol: boolean;
  pnlCompleteUsd: boolean;
  trades: RealizedTrade[];
}

export interface RealizedTrade {
  mint: string;
  signature: string;
  timestamp: number;
  quantity: number;
  realizedPnlSol: number | null;
  realizedPnlUsd: number | null;
  holdSeconds: number | null;
}

interface BalanceDelta {
  mint: string;
  amount: number;
  decimals: number;
}

interface CashValue {
  sol: number | null;
  usd: number | null;
}

interface Lot {
  remaining: number;
  timestamp: number;
  costSol: number | null;
  costUsd: number | null;
  kind: "swap" | "transfer";
}

interface MutableTokenPerformance {
  mint: string;
  totalBought: number;
  totalSold: number;
  entryCostSol: number;
  entryCostSolQuantity: number;
  entryCostUsd: number;
  entryCostUsdQuantity: number;
  exitValueSol: number;
  exitValueSolQuantity: number;
  exitValueUsd: number;
  exitValueUsdQuantity: number;
  realizedPnlSol: number;
  realizedPnlUsd: number;
  holdQuantitySeconds: number;
  heldQuantity: number;
  unpricedSoldQuantity: number;
  unpricedUsdSoldQuantity: number;
  trades: RealizedTrade[];
}

/**
 * Applies swaps to FIFO lots. Incoming non-swap tokens are tracked as unknown-basis
 * transfer lots; outgoing non-swap transfers consume inventory without recording a sale.
 * Network and protocol fees are not allocated into token cost basis.
 */
export function calculateTokenPerformance(
  wallet: string,
  history: HeliusEnhancedTransaction[],
): TokenPerformance[] {
  const lotsByMint = new Map<string, Lot[]>();
  const metricsByMint = new Map<string, MutableTokenPerformance>();

  const orderedHistory = [...history].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  for (const transaction of orderedHistory) {
    const timestamp = transaction.timestamp ?? 0;
    const deltas = getTokenDeltas(transaction, wallet);
    if (deltas.length === 0) continue;

    const isSwap = transaction.type?.toUpperCase() === "SWAP";
    const cashDeltas = getCashDeltas(transaction, wallet, deltas);

    for (const delta of deltas) {
      if (delta.amount === 0 || isCashMint(delta.mint)) continue;
      const quantity = Math.abs(delta.amount);
      const lots = lotsByMint.get(delta.mint) ?? [];
      const metrics = getMetrics(metricsByMint, delta.mint);

      if (!isSwap) {
        if (delta.amount > 0) {
          lots.push({ remaining: quantity, timestamp, costSol: null, costUsd: null, kind: "transfer" });
        } else {
          consumeLots(lots, quantity, timestamp, null, null, false, metrics, transaction.signature, delta.mint);
        }
        lotsByMint.set(delta.mint, lots);
        continue;
      }

      const cash = chooseCashValue(delta.amount, cashDeltas);
      if (delta.amount > 0) {
        metrics.totalBought += quantity;
        if (cash.sol !== null) {
          metrics.entryCostSol += cash.sol;
          metrics.entryCostSolQuantity += quantity;
        }
        if (cash.usd !== null) {
          metrics.entryCostUsd += cash.usd;
          metrics.entryCostUsdQuantity += quantity;
        }
        lots.push({ remaining: quantity, timestamp, costSol: cash.sol, costUsd: cash.usd, kind: "swap" });
      } else {
        metrics.totalSold += quantity;
        if (cash.sol !== null) {
          metrics.exitValueSol += cash.sol;
          metrics.exitValueSolQuantity += quantity;
        }
        if (cash.usd !== null) {
          metrics.exitValueUsd += cash.usd;
          metrics.exitValueUsdQuantity += quantity;
        }
        consumeLots(lots, quantity, timestamp, cash.sol, cash.usd, true, metrics, transaction.signature, delta.mint);
      }
      lotsByMint.set(delta.mint, lots);
    }
  }

  return [...metricsByMint.values()]
    .map((metrics) => {
      return {
        mint: metrics.mint,
        totalBought: metrics.totalBought,
        totalSold: metrics.totalSold,
        realizedPnlSol: metrics.realizedPnlSol,
        realizedPnlUsd: metrics.trades.some((trade) => trade.realizedPnlUsd !== null)
          ? metrics.realizedPnlUsd
          : null,
        averageEntryPriceSol: metrics.totalBought > 0 && metrics.entryCostSolQuantity === metrics.totalBought
          ? metrics.entryCostSol / metrics.totalBought
          : null,
        averageEntryPriceUsd: metrics.totalBought > 0 && metrics.entryCostUsdQuantity === metrics.totalBought
          ? metrics.entryCostUsd / metrics.totalBought
          : null,
        averageExitPriceSol: metrics.totalSold > 0 && metrics.exitValueSolQuantity === metrics.totalSold
          ? metrics.exitValueSol / metrics.totalSold
          : null,
        averageExitPriceUsd: metrics.totalSold > 0 && metrics.exitValueUsdQuantity === metrics.totalSold
          ? metrics.exitValueUsd / metrics.totalSold
          : null,
        averageHoldSeconds: metrics.heldQuantity > 0
          ? metrics.holdQuantitySeconds / metrics.heldQuantity
          : null,
        unpricedSoldQuantity: metrics.unpricedSoldQuantity,
        unpricedUsdSoldQuantity: metrics.unpricedUsdSoldQuantity,
        pnlCompleteSol: metrics.unpricedSoldQuantity === 0,
        pnlCompleteUsd: metrics.unpricedUsdSoldQuantity === 0,
        trades: metrics.trades,
      } satisfies TokenPerformance;
    })
    .sort((a, b) => (b.realizedPnlSol ?? 0) - (a.realizedPnlSol ?? 0));
}

function getTokenDeltas(transaction: HeliusEnhancedTransaction, wallet: string): BalanceDelta[] {
  const amounts = new Map<string, { amount: number; decimals: number }>();

  for (const account of transaction.accountData ?? []) {
    for (const change of account.tokenBalanceChanges ?? []) {
      if (change.userAccount !== wallet || !change.mint) continue;
      const raw = change.rawTokenAmount?.tokenAmount;
      const decimals = change.rawTokenAmount?.decimals;
      if (raw === undefined || decimals === undefined) continue;
      const amount = Number(raw) / 10 ** decimals;
      if (!Number.isFinite(amount)) continue;
      const previous = amounts.get(change.mint) ?? { amount: 0, decimals };
      previous.amount += amount;
      amounts.set(change.mint, previous);
    }
  }

  // Some parsed legacy transactions have token transfers but omit balance deltas.
  if (amounts.size === 0) {
    for (const transfer of transaction.tokenTransfers ?? []) {
      if (!transfer.mint || !Number.isFinite(transfer.tokenAmount)) continue;
      const isIncoming = transfer.toUserAccount === wallet;
      const isOutgoing = transfer.fromUserAccount === wallet;
      if (!isIncoming && !isOutgoing) continue;
      const amount = (transfer.tokenAmount ?? 0) * (isIncoming ? 1 : -1);
      const previous = amounts.get(transfer.mint) ?? { amount: 0, decimals: 0 };
      previous.amount += amount;
      amounts.set(transfer.mint, previous);
    }
  }

  return [...amounts].map(([mint, value]) => ({ mint, ...value }));
}

function getCashDeltas(
  transaction: HeliusEnhancedTransaction,
  wallet: string,
  tokenDeltas: BalanceDelta[],
): Map<string, number> {
  const cash = new Map<string, number>();
  for (const delta of tokenDeltas) {
    if (!isCashMint(delta.mint)) continue;
    cash.set(delta.mint, (cash.get(delta.mint) ?? 0) + delta.amount);
  }

  const nativeTransferDelta = (transaction.nativeTransfers ?? []).reduce((total, transfer) => {
    const sent = transfer.fromUserAccount === wallet ? transfer.amount ?? 0 : 0;
    const received = transfer.toUserAccount === wallet ? transfer.amount ?? 0 : 0;
    return total + (received - sent) / LAMPORTS_PER_SOL;
  }, 0);
  const nativeInput = transaction.events?.swap?.nativeInput;
  const nativeOutput = transaction.events?.swap?.nativeOutput;
  const parsedNativeDelta = [nativeInput, nativeOutput]
    .filter((change) => change?.account === wallet)
    .reduce((sum, change) => sum + Number(change?.amount ?? 0), 0) / LAMPORTS_PER_SOL;
  const nativeDelta = Number.isFinite(parsedNativeDelta) && parsedNativeDelta !== 0
    ? parsedNativeDelta
    : nativeTransferDelta;
  if (nativeDelta !== 0) cash.set(SOL_MINT, (cash.get(SOL_MINT) ?? 0) + nativeDelta);

  return cash;
}

function chooseCashValue(tokenDelta: number, cashDeltas: Map<string, number>): CashValue {
  const oppositeSign = tokenDelta > 0 ? -1 : 1;
  let sol: number | null = null;
  let usd: number | null = null;

  for (const [mint, delta] of cashDeltas) {
    if (delta * oppositeSign <= 0) continue;
    const quantity = Math.abs(delta);
    if (mint === SOL_MINT) sol = quantity;
    else if (STABLECOIN_MINTS.has(mint)) usd = quantity;
  }
  return { sol, usd };
}

function consumeLots(
  lots: Lot[],
  quantity: number,
  timestamp: number,
  proceedsSol: number | null,
  proceedsUsd: number | null,
  isSale: boolean,
  metrics: MutableTokenPerformance,
  signature: string,
  mint: string,
): void {
  let remainingToMatch = quantity;
  let matchedQuantity = 0;
  let knownSolBasis = 0;
  let knownSolQuantity = 0;
  let knownUsdBasis = 0;
  let knownUsdQuantity = 0;
  let holdValue = 0;
  let holdQuantity = 0;
  let unknownSolQuantity = 0;
  let unknownUsdQuantity = 0;

  while (remainingToMatch > 1e-12 && lots.length > 0) {
    const lot = lots[0];
    const matched = Math.min(remainingToMatch, lot.remaining);
    matchedQuantity += matched;
    holdValue += Math.max(0, timestamp - lot.timestamp) * matched;
    holdQuantity += matched;
    if (lot.kind === "transfer") {
      unknownSolQuantity += matched;
      unknownUsdQuantity += matched;
    } else {
      if (lot.costSol === null) unknownSolQuantity += matched;
      else {
        const consumedCost = (lot.costSol * matched) / lot.remaining;
        knownSolBasis += consumedCost;
        lot.costSol -= consumedCost;
      }
      if (lot.costSol !== null) knownSolQuantity += matched;
      if (lot.costUsd === null) unknownUsdQuantity += matched;
      else {
        const consumedCost = (lot.costUsd * matched) / lot.remaining;
        knownUsdBasis += consumedCost;
        lot.costUsd -= consumedCost;
      }
      if (lot.costUsd !== null) knownUsdQuantity += matched;
    }
    lot.remaining -= matched;
    remainingToMatch -= matched;
    if (lot.remaining <= 1e-12) lots.shift();
  }

  if (!isSale) return;
  metrics.heldQuantity += holdQuantity;
  metrics.holdQuantitySeconds += holdValue;

  if (matchedQuantity === 0) {
    metrics.unpricedSoldQuantity += quantity;
    metrics.unpricedUsdSoldQuantity += quantity;
    metrics.trades.push({ mint, signature, timestamp, quantity, realizedPnlSol: null, realizedPnlUsd: null, holdSeconds: null });
    return;
  }

  const matchedProceedsSol = proceedsSol === null ? null : proceedsSol * (matchedQuantity / quantity);
  const matchedProceedsUsd = proceedsUsd === null ? null : proceedsUsd * (matchedQuantity / quantity);
  const solComplete = unknownSolQuantity === 0 && knownSolQuantity === matchedQuantity && matchedProceedsSol !== null;
  const usdComplete = unknownUsdQuantity === 0 && knownUsdQuantity === matchedQuantity && matchedProceedsUsd !== null;
  const realizedPnlSol = solComplete ? matchedProceedsSol! - knownSolBasis : null;
  const realizedPnlUsd = usdComplete ? matchedProceedsUsd! - knownUsdBasis : null;

  if (realizedPnlSol === null) metrics.unpricedSoldQuantity += matchedQuantity;
  else metrics.realizedPnlSol += realizedPnlSol;
  if (realizedPnlUsd === null) metrics.unpricedUsdSoldQuantity += matchedQuantity;
  else metrics.realizedPnlUsd += realizedPnlUsd;
  if (remainingToMatch > 1e-12) {
    metrics.unpricedSoldQuantity += remainingToMatch;
    metrics.unpricedUsdSoldQuantity += remainingToMatch;
  }

  metrics.trades.push({
    mint,
    signature,
    timestamp,
    quantity: matchedQuantity,
    realizedPnlSol,
    realizedPnlUsd,
    holdSeconds: holdQuantity > 0 ? holdValue / holdQuantity : null,
  });
}

function isCashMint(mint: string): boolean {
  return mint === SOL_MINT || STABLECOIN_MINTS.has(mint);
}

function getMetrics(map: Map<string, MutableTokenPerformance>, mint: string): MutableTokenPerformance {
  let metrics = map.get(mint);
  if (!metrics) {
    metrics = {
      mint,
      totalBought: 0,
      totalSold: 0,
      entryCostSol: 0,
      entryCostSolQuantity: 0,
      entryCostUsd: 0,
      entryCostUsdQuantity: 0,
      exitValueSol: 0,
      exitValueSolQuantity: 0,
      exitValueUsd: 0,
      exitValueUsdQuantity: 0,
      realizedPnlSol: 0,
      realizedPnlUsd: 0,
      holdQuantitySeconds: 0,
      heldQuantity: 0,
      unpricedSoldQuantity: 0,
      unpricedUsdSoldQuantity: 0,
      trades: [],
    };
    map.set(mint, metrics);
  }
  return metrics;
}
