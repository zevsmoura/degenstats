import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pnl = finiteNumber(params.get("pnlSol"), -1_000_000, 1_000_000);
  const wallet = params.get("wallet")?.slice(0, 60) ?? "Solana wallet";
  const winRate = safeText(params.get("winRate"), "—", 16);
  const trades = safeText(params.get("trades"), "0", 8);
  const hold = safeText(params.get("hold"), "—", 16);
  const pnlLabel = pnl === null ? "— SOL" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(3)} SOL`;
  const pnlColor = pnl !== null && pnl >= 0 ? "#b7f56a" : "#ff9696";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#080a0d", color: "#f6f8f2", padding: 54, fontFamily: "Arial, sans-serif" }}>
        <div style={{ position: "absolute", right: -80, top: -180, width: 600, height: 600, borderRadius: 300, background: "radial-gradient(circle, rgba(183,245,106,0.16), rgba(8,10,13,0) 68%)" }} />
        <div style={{ width: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 11, background: "#b7f56a", color: "#11150d", fontSize: 21, fontWeight: 900 }}>D</div>
              <div style={{ display: "flex", fontSize: 21, fontWeight: 900, letterSpacing: -1 }}>DEGEN<span style={{ color: "#b7f56a" }}>STATS</span></div>
            </div>
            <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 99, padding: "8px 13px", fontSize: 11, color: "rgba(255,255,255,0.53)", letterSpacing: 2 }}>SOLANA · READ ONLY</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 54 }}>
            <div style={{ display: "flex", color: "#b7f56a", fontSize: 12, fontWeight: 700, letterSpacing: 4 }}>ON-CHAIN RECEIPTS</div>
            <div style={{ display: "flex", marginTop: 12, fontSize: 54, fontWeight: 900, letterSpacing: -3 }}>My wallet. The receipts.</div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 16, color: "rgba(255,255,255,0.44)" }}>{wallet.length > 18 ? `${wallet.slice(0, 8)}…${wallet.slice(-7)}` : wallet}</div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 38, flex: 1 }}>
            <div style={{ flex: 1.45, display: "flex", flexDirection: "column", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, background: "rgba(255,255,255,0.035)", padding: "20px 25px" }}>
              <div style={{ display: "flex", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 2 }}>REALIZED P&amp;L</div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 43, color: pnlColor, fontWeight: 900, letterSpacing: -2 }}>{pnlLabel}</div>
            </div>
            {[["WIN RATE", winRate], ["PRICED CLOSES", trades], ["AVG HOLD", hold]].map(([label, value]) => (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, background: "rgba(255,255,255,0.035)", padding: "20px 18px" }}>
                <div style={{ display: "flex", fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1.4 }}>{label}</div>
                <div style={{ display: "flex", marginTop: 12, fontSize: 27, color: "#f6f8f2", fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, color: "rgba(255,255,255,0.32)", fontSize: 11 }}>
            <div style={{ display: "flex" }}>Analytics only · Not financial advice · Fees excluded</div>
            <div style={{ display: "flex", color: "rgba(183,245,106,0.7)", fontWeight: 700, letterSpacing: 1 }}>DEGENSTATS</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function finiteNumber(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : null;
}

function safeText(value: string | null, fallback: string, maxLength: number): string {
  return value ? value.replace(/[<>]/g, "").slice(0, maxLength) : fallback;
}
