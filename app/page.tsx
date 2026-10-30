export default function Home() {
  return (
    <main className="min-h-screen bg-[#090b10] text-[#f4f5f7]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        <header className="flex h-20 items-center justify-between border-b border-white/10">
          <span className="text-lg font-black tracking-tight">DEGEN<span className="text-lime-300">STATS</span></span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">SOLANA · READ ONLY</span>
        </header>
        <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.32em] text-lime-300">On-chain receipts</p>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.03] tracking-tight sm:text-7xl">Your wallet has a P&amp;L.<br /><span className="text-white/40">Let’s see the damage.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/55">Degenstats turns your Solana swaps into a clear trading history. Public address only. No wallet connection, ever.</p>
          <div className="mt-10 w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl shadow-lime-950/20 sm:flex sm:gap-3">
            <input aria-label="Solana wallet address" disabled placeholder="Paste a Solana wallet address" className="h-12 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30" />
            <button disabled className="mt-2 h-12 w-full rounded-xl bg-lime-300 px-6 text-sm font-bold text-black opacity-50 sm:mt-0 sm:w-auto">Analyze wallet</button>
          </div>
          <p className="mt-4 text-xs text-white/35">Analytics only · Never enter a seed phrase or private key</p>
        </section>
        <footer className="border-t border-white/10 py-5 text-center text-xs text-white/35">For analytics only. Not financial advice. On-chain data may be incomplete.</footer>
      </div>
    </main>
  );
}
