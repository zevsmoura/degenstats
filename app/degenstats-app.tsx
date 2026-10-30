"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RealizedTrade, TokenPerformance } from "@/lib/analytics/pnl";
import { isValidSolanaAddress } from "@/lib/solana/address";

interface AnalysisResponse {
  address: string;
  status: "ok" | "empty" | "no-swaps";
  transactionCount: number;
  swapCount?: number;
  tokens: TokenPerformance[];
  caveats?: string[];
  message?: string;
}

interface ChartPoint {
  day: string;
  timestamp: number;
  pnl: number;
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function DegenstatsApp() {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const knownTrades = useMemo(() => (analysis?.tokens ?? [])
    .flatMap((token) => token.trades)
    .filter((trade): trade is RealizedTrade & { realizedPnlSol: number } => trade.realizedPnlSol !== null)
    .sort((a, b) => a.timestamp - b.timestamp), [analysis]);

  const points = useMemo(() => makeChartPoints(knownTrades), [knownTrades]);
  const metrics = useMemo(() => summarize(analysis, knownTrades), [analysis, knownTrades]);
  const insights = useMemo(() => makeInsights(analysis, knownTrades), [analysis, knownTrades]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wallet = address.trim();
    if (!isValidSolanaAddress(wallet)) {
      setError("That address doesn’t look right. Paste a valid Solana public address.");
      setAnalysis(null);
      return;
    }

    setError("");
    setAnalysis(null);
    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: wallet }),
      });
      const payload = await response.json() as AnalysisResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Couldn’t analyze that wallet. Try again.");
      setAnalysis(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went sideways. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearAnalysis() {
    setAnalysis(null);
    setError("");
    setAddress("");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080a0d] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background:radial-gradient(ellipse_at_50%_0%,rgba(170,255,80,0.1),transparent_38%)]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.08]">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Degenstats home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-300 text-sm font-black text-[#10140b]">D</span>
            <span className="text-[15px] font-black tracking-[-0.04em]">DEGEN<span className="text-lime-300">STATS</span></span>
          </a>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-300" /> SOLANA · READ ONLY
          </div>
        </header>

        <section id="top" className={`relative mx-auto w-full max-w-4xl text-center ${analysis ? "pb-10 pt-16 sm:pt-20" : "pb-20 pt-24 sm:pb-28 sm:pt-32"}`}>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-lime-200/85">
            <span className="text-sm">✳</span> ON-CHAIN RECEIPTS
          </div>
          <h1 className={`${analysis ? "text-4xl sm:text-5xl" : "text-5xl sm:text-7xl"} font-black leading-[0.98] tracking-[-0.055em]`}>
            Your wallet has a P&amp;L.<br /><span className="text-white/35">Let’s see the damage.</span>
          </h1>
          {!analysis && <p className="mx-auto mt-6 max-w-lg text-sm leading-6 text-white/50 sm:text-base">The receipts, without the wallet connect. Read your Solana swap history and see what actually stuck.</p>}

          <form onSubmit={handleSubmit} className="mx-auto mt-9 flex w-full max-w-2xl flex-col gap-2 rounded-[18px] border border-white/[0.11] bg-[#11151a] p-2 shadow-[0_20px_90px_rgba(0,0,0,0.35)] sm:flex-row">
            <label className="sr-only" htmlFor="wallet">Paste a Solana wallet address</label>
            <input
              id="wallet"
              autoComplete="off"
              spellCheck={false}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Paste a Solana wallet address"
              className="h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button type="submit" disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 text-sm font-extrabold text-[#14170e] transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-70">
              {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> Reading swaps</> : <>Analyze wallet <span aria-hidden="true">↗</span></>}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/35">
            <span>No wallet connection</span><span className="hidden sm:inline">·</span><span>Never enter a seed phrase</span><span className="hidden sm:inline">·</span><span>Public address only</span>
          </div>
          {error && <div role="alert" className="mx-auto mt-5 max-w-2xl rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-left text-sm text-rose-200">{error}</div>}
        </section>

        {analysis && analysis.status === "empty" && <EmptyState title="No history found" body="This address has no transaction history we could read. Double-check it and give it another shot." />}
        {analysis && analysis.status === "no-swaps" && <EmptyState title="No swaps in this wallet" body={`We scanned ${analysis.transactionCount.toLocaleString()} transactions and didn’t find any swaps to score.`} />}
        {analysis && analysis.status === "ok" && (
          <Dashboard
            analysis={analysis}
            metrics={metrics}
            knownTrades={knownTrades}
            points={points}
            insights={insights}
            onClear={clearAnalysis}
          />
        )}

        <footer className="mt-20 flex flex-col items-center justify-between gap-3 border-t border-white/[0.08] py-6 text-center text-[11px] text-white/35 sm:flex-row sm:text-left">
          <span>DEGENSTATS <span className="mx-1 text-white/15">/</span> SOLANA TRADE RECEIPTS</span>
          <span>Analytics only. Not financial advice. On-chain data may be incomplete.</span>
        </footer>
      </div>
    </main>
  );
}

interface DashboardProps {
  analysis: AnalysisResponse;
  metrics: ReturnType<typeof summarize>;
  knownTrades: Array<RealizedTrade & { realizedPnlSol: number }>;
  points: ChartPoint[];
  insights: string[];
  onClear: () => void;
}

function Dashboard({ analysis, metrics, knownTrades, points, insights, onClear }: DashboardProps) {
  const best = [...knownTrades].sort((a, b) => b.realizedPnlSol - a.realizedPnlSol).slice(0, 3);
  const worst = [...knownTrades].sort((a, b) => a.realizedPnlSol - b.realizedPnlSol).slice(0, 3);
  const usdIsPartial = analysis.tokens.some((token) => !token.pnlCompleteUsd);

  return (
    <section className="animate-[fade-in_350ms_ease-out] pb-4">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em] text-white/35">WALLET REPORT <span className="px-1 text-white/15">/</span> {analysis.transactionCount.toLocaleString()} TX SCANNED</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-white/75">{shortAddress(analysis.address)}</span>
            <button onClick={() => navigator.clipboard?.writeText(analysis.address)} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/45 transition hover:border-white/25 hover:text-white/75">Copy</button>
            <span className="rounded-md bg-lime-300/[0.08] px-2 py-1 text-[10px] font-semibold text-lime-200/75">{(analysis.swapCount ?? 0).toLocaleString()} swaps</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ShareButton analysis={analysis} metrics={metrics} tradeCount={knownTrades.length} />
          <button onClick={onClear} className="h-10 rounded-lg border border-white/10 px-3.5 text-xs font-semibold text-white/60 transition hover:border-white/25 hover:text-white">New wallet</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="REALIZED P&L" value={`${metrics.totalPnlSol >= 0 ? "+" : ""}${numberFormat.format(metrics.totalPnlSol)} SOL`} accent={metrics.totalPnlSol >= 0} sub={metrics.solPartial ? "Priced closes only · incomplete basis" : "FIFO · fees excluded"} />
        <StatCard label="WIN RATE" value={metrics.winRate === null ? "—" : `${numberFormat.format(metrics.winRate)}%`} sub={`${knownTrades.length} priced closed ${knownTrades.length === 1 ? "trade" : "trades"}`} />
        <StatCard label="AVERAGE WIN" value={metrics.averageWin === null ? "—" : `+${numberFormat.format(metrics.averageWin)} SOL`} accent sub="Per profitable close" />
        <StatCard label="AVERAGE LOSS" value={metrics.averageLoss === null ? "—" : `−${numberFormat.format(metrics.averageLoss)} SOL`} danger={metrics.averageLoss !== null} sub="Per losing close" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <section className="panel min-h-[345px] p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div><h2 className="text-sm font-bold">P&amp;L over time</h2><p className="mt-1 text-xs text-white/40">Cumulative realized SOL · FIFO closes</p></div>
            <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-white/35">ALL HISTORY</span>
          </div>
          {points.length > 0 ? (
            <div className="mt-6 h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                  <defs><linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7f56a" stopOpacity={0.28} /><stop offset="100%" stopColor="#b7f56a" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 10 }} minTickGap={30} />
                  <YAxis tickLine={false} axisLine={false} width={57} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 10 }} tickFormatter={(value: number) => `${numberFormat.format(value)}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="pnl" stroke="#b7f56a" strokeWidth={2.5} fill="url(#pnlFill)" activeDot={{ r: 4, fill: "#b7f56a", stroke: "#11151a", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="mt-6 grid h-[250px] place-items-center rounded-xl border border-dashed border-white/10 text-center text-xs text-white/35">No fully priced SOL closes to chart yet.</div>}
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-bold">Quick read</h2><p className="mt-1 text-xs text-white/40">Three signals from your closes</p></div>
            <span className="text-lg text-lime-300">✳</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {insights.map((insight, index) => (
              <div key={insight} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-lime-300/[0.1] text-[10px] font-black text-lime-200">0{index + 1}</span>
                <p className="pt-0.5 text-xs leading-5 text-white/70">{insight}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[9px] font-bold tracking-[0.17em] text-white/35">AVG HOLD</p><p className="mt-1.5 text-lg font-bold">{formatDuration(metrics.averageHoldSeconds)}</p></div>
            <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[9px] font-bold tracking-[0.17em] text-white/35">REALIZED USD</p><p className="mt-1.5 text-lg font-bold">{metrics.totalPnlUsd === null ? "—" : usdFormat.format(metrics.totalPnlUsd)}</p><p className="mt-0.5 text-[9px] text-white/30">{metrics.totalPnlUsd === null ? "No stablecoin-priced closes" : usdIsPartial ? "Priced routes only" : "USDC / USDT legs"}</p></div>
          </div>
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <TradeList title="Biggest wins" helper="The green candles you actually closed" trades={best} positive />
        <TradeList title="Biggest losses" helper="The ones that left a mark" trades={worst} />
      </div>

      <section className="panel mt-3 overflow-hidden">
        <div className="flex items-end justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
          <div><h2 className="text-sm font-bold">Token ledger</h2><p className="mt-1 text-xs text-white/40">Per-mint totals · transfer basis may be unknown</p></div>
          <span className="text-[10px] text-white/35">{analysis.tokens.length} TOKENS</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-y border-white/[0.07] text-[9px] font-bold tracking-[0.14em] text-white/35"><th className="px-5 py-3 sm:px-6">TOKEN MINT</th><th className="px-3 py-3">BOUGHT</th><th className="px-3 py-3">SOLD</th><th className="px-3 py-3">AVG ENTRY</th><th className="px-3 py-3">AVG EXIT</th><th className="px-3 py-3">REALIZED P&amp;L</th><th className="px-3 py-3">AVG HOLD</th></tr></thead>
            <tbody>{analysis.tokens.map((token) => <TokenRow key={token.mint} token={token} />)}</tbody>
          </table>
        </div>
        {analysis.tokens.some((token) => !token.pnlCompleteSol) && <p className="px-5 pb-4 text-[10px] text-white/35 sm:px-6">* Partial: some sold units have unknown or unpriced basis.</p>}
      </section>

      {analysis.caveats && <details className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[11px] text-white/40"><summary className="cursor-pointer font-semibold text-white/50">How to read these numbers</summary><ul className="mt-3 list-disc space-y-1.5 pl-4">{analysis.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></details>}
    </section>
  );
}

function StatCard({ label, value, sub, accent = false, danger = false }: { label: string; value: string; sub: string; accent?: boolean; danger?: boolean }) {
  return <div className="panel min-h-[126px] p-4 sm:p-5"><p className="text-[9px] font-bold tracking-[0.17em] text-white/38">{label}</p><p className={`mt-3 truncate text-[21px] font-extrabold tracking-[-0.04em] sm:text-[25px] ${accent ? "text-lime-300" : danger ? "text-rose-300" : "text-white"}`}>{value}</p><p className="mt-1.5 truncate text-[10px] text-white/35">{sub}</p></div>;
}

function TradeList({ title, helper, trades, positive = false }: { title: string; helper: string; trades: Array<RealizedTrade & { realizedPnlSol: number }>; positive?: boolean }) {
  return <section className="panel p-5 sm:p-6">
    <div className="mb-4"><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-white/40">{helper}</p></div>
    {trades.length === 0 ? <p className="rounded-lg bg-white/[0.025] p-4 text-xs text-white/35">No priced closes in this lane yet.</p> : <div className="space-y-2">{trades.map((trade) => <div key={`${trade.signature}-${trade.mint}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3.5 py-3"><div className="min-w-0"><p className="font-mono text-xs text-white/70">{shortMint(trade.mint)}</p><p className="mt-1 text-[10px] text-white/35">{new Date(trade.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} <span className="px-1 text-white/15">·</span> held {formatDuration(trade.holdSeconds)}</p></div><p className={`shrink-0 font-mono text-sm font-bold ${positive ? "text-lime-300" : "text-rose-300"}`}>{trade.realizedPnlSol > 0 ? "+" : ""}{numberFormat.format(trade.realizedPnlSol)} SOL</p></div>)}</div>}
  </section>;
}

function TokenRow({ token }: { token: TokenPerformance }) {
  const pnl = token.realizedPnlSol;
  return <tr className="border-b border-white/[0.055] last:border-0"><td className="px-5 py-3.5 font-mono text-[11px] text-white/70 sm:px-6">{shortMint(token.mint)}</td><td className="px-3 py-3.5 font-mono text-[11px] text-white/55">{numberFormat.format(token.totalBought)}</td><td className="px-3 py-3.5 font-mono text-[11px] text-white/55">{numberFormat.format(token.totalSold)}</td><td className="px-3 py-3.5 text-[11px] text-white/50">{token.averageEntryPriceSol === null ? "—" : `${numberFormat.format(token.averageEntryPriceSol)} SOL`}</td><td className="px-3 py-3.5 text-[11px] text-white/50">{token.averageExitPriceSol === null ? "—" : `${numberFormat.format(token.averageExitPriceSol)} SOL`}</td><td className={`px-3 py-3.5 font-mono text-[11px] font-bold ${pnl >= 0 ? "text-lime-300" : "text-rose-300"}`}>{pnl > 0 ? "+" : ""}{numberFormat.format(pnl)}{token.pnlCompleteSol ? "" : "*"} SOL</td><td className="px-3 py-3.5 text-[11px] text-white/50">{formatDuration(token.averageHoldSeconds)}</td></tr>;
}

function ShareButton({ analysis, metrics, tradeCount }: { analysis: AnalysisResponse; metrics: ReturnType<typeof summarize>; tradeCount: number }) {
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");

  async function shareCard() {
    setSharing(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        wallet: analysis.address,
        pnlSol: metrics.totalPnlSol.toFixed(4),
        winRate: metrics.winRate === null ? "—" : `${metrics.winRate.toFixed(1)}%`,
        trades: String(tradeCount),
        hold: formatDuration(metrics.averageHoldSeconds),
      });
      const response = await fetch(`/api/share?${params.toString()}`);
      if (!response.ok) throw new Error("Card generation failed. Try once more.");
      const file = new File([await response.blob()], "degenstats-card.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "My Degenstats wallet report" });
      } else {
        const href = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = href;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(href);
        setMessage("Card saved");
        window.setTimeout(() => setMessage(""), 2500);
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setMessage(cause instanceof Error ? cause.message : "Could not make that card.");
    } finally {
      setSharing(false);
    }
  }

  return <div className="relative"><button onClick={shareCard} disabled={sharing} className="flex h-10 items-center gap-2 rounded-lg border border-lime-300/20 bg-lime-300/[0.07] px-3.5 text-xs font-semibold text-lime-200 transition hover:bg-lime-300/[0.13] disabled:opacity-60">{sharing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lime-200/30 border-t-lime-200" /> : <ShareIcon />} {sharing ? "Making card" : "Share card"}</button>{message && <span role="status" className="absolute right-0 top-12 z-10 w-52 rounded-lg border border-white/10 bg-[#161a1e] px-3 py-2 text-[10px] text-white/70">{message}</span>}</div>;
}

function ShareIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-white/10 bg-[#13171b] px-3 py-2 shadow-xl"><p className="text-[10px] text-white/40">{label}</p><p className="mt-1 font-mono text-xs font-bold text-lime-300">{payload[0].value >= 0 ? "+" : ""}{numberFormat.format(payload[0].value)} SOL</p></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <section className="panel mx-auto max-w-xl px-6 py-10 text-center"><span className="text-2xl text-lime-300">◌</span><h2 className="mt-3 text-lg font-bold">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">{body}</p></section>;
}

function summarize(analysis: AnalysisResponse | null, trades: Array<RealizedTrade & { realizedPnlSol: number }>) {
  const wins = trades.filter((trade) => trade.realizedPnlSol > 0);
  const losses = trades.filter((trade) => trade.realizedPnlSol < 0);
  const knownUsd = (analysis?.tokens ?? []).filter((token) => token.realizedPnlUsd !== null);
  const totalPnlSol = trades.reduce((sum, trade) => sum + trade.realizedPnlSol, 0);
  return {
    totalPnlSol,
    totalPnlUsd: knownUsd.length > 0 ? knownUsd.reduce((sum, token) => sum + (token.realizedPnlUsd ?? 0), 0) : null,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : null,
    averageWin: wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.realizedPnlSol, 0) / wins.length : null,
    averageLoss: losses.length > 0 ? Math.abs(losses.reduce((sum, trade) => sum + trade.realizedPnlSol, 0) / losses.length) : null,
    averageHoldSeconds: weightedHoldTime(trades),
    solPartial: (analysis?.tokens ?? []).some((token) => !token.pnlCompleteSol),
  };
}

function makeChartPoints(trades: Array<RealizedTrade & { realizedPnlSol: number }>): ChartPoint[] {
  const byDay = new Map<string, { timestamp: number; pnl: number }>();
  for (const trade of trades) {
    const date = new Date(trade.timestamp * 1000);
    const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
    const current = byDay.get(day) ?? { timestamp: trade.timestamp, pnl: 0 };
    current.pnl += trade.realizedPnlSol;
    current.timestamp = Math.min(current.timestamp, trade.timestamp);
    byDay.set(day, current);
  }
  let running = 0;
  return [...byDay.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp).map(([day, item]) => {
    running += item.pnl;
    return { day, timestamp: item.timestamp, pnl: running };
  });
}

function makeInsights(analysis: AnalysisResponse | null, trades: Array<RealizedTrade & { realizedPnlSol: number }>): string[] {
  if (trades.length === 0) return [
    "No fully priced closes yet. A transfer or missing quote leg can leave the basis unknown.",
    "Your swap history is in. Once a position closes with a known basis, the scoreboard fills in.",
    "Network and protocol fees are excluded from this first pass, so the chain may take a little extra.",
  ];

  const wins = trades.filter((trade) => trade.realizedPnlSol > 0);
  const losses = trades.filter((trade) => trade.realizedPnlSol < 0);
  const winHold = weightedHoldTime(wins);
  const lossHold = weightedHoldTime(losses);
  const best = [...trades].sort((a, b) => b.realizedPnlSol - a.realizedPnlSol)[0];
  const bestMint = shortMint(best.mint);
  const winRate = (wins.length / trades.length) * 100;
  const holdInsight = winHold !== null && lossHold !== null && winHold > 0 && lossHold > winHold
    ? `Losers stayed open ${numberFormat.format(lossHold / winHold)}× longer than winners. The bag-hold is real.`
    : winHold !== null && lossHold !== null && lossHold > 0 && winHold > lossHold
      ? `Winners stayed open ${numberFormat.format(winHold / lossHold)}× longer than losers. You let the green ones breathe.`
      : winHold !== null && lossHold !== null
        ? "Winner and loser hold times are close. Your exits are moving at a similar pace."
        : "Not enough priced hold-time data to compare winners and losers yet.";
  const winInsight = winRate >= 50
    ? `You closed green on ${numberFormat.format(winRate)}% of priced trades. Keep an eye on the size of the red ones.`
    : `Only ${numberFormat.format(winRate)}% of priced closes were green. Your average win/loss size tells the rest of the story.`;
  const incomplete = analysis?.tokens.some((token) => !token.pnlCompleteSol) ?? false;
  const bestInsight = `Your top close was ${bestMint} at +${numberFormat.format(best.realizedPnlSol)} SOL.${incomplete ? " Some other closes still have unknown basis." : ""}`;
  return [holdInsight, winInsight, bestInsight];
}

function weightedHoldTime(trades: RealizedTrade[]): number | null {
  const held = trades.filter((trade) => trade.holdSeconds !== null && trade.quantity > 0);
  const quantity = held.reduce((sum, trade) => sum + trade.quantity, 0);
  return quantity > 0 ? held.reduce((sum, trade) => sum + (trade.holdSeconds ?? 0) * trade.quantity, 0) / quantity : null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${numberFormat.format(seconds / 3600)}h`;
  return `${numberFormat.format(seconds / 86400)}d`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

function shortMint(mint: string): string {
  return `${mint.slice(0, 5)}…${mint.slice(-5)}`;
}
