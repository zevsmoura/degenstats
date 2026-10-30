# Degenstats

Degenstats is a read-only Solana wallet trading analytics app built with Next.js App Router, TypeScript, and Tailwind CSS. It analyzes public on-chain activity and never requests wallet connections, private keys, or seed phrases.

## Setup

1. Install Node.js 20.9 or newer and pnpm.
2. Install dependencies with `pnpm install`.
3. Copy `.env.example` to `.env.local` and set the API key.
4. Start the development server with `pnpm dev`.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `HELIUS_API_KEY` | Helius Enhanced Transactions API key used to read wallet swap history. |

Keep `.env.local` private. It is excluded from Git.

## Wallet analysis API

`POST /api/analyze` accepts `{ "address": "<public Solana address>" }`. It validates the base58 public key before calling Helius, fetches transaction history page by page, and returns per-token FIFO realized P&L. It returns a clear error for invalid addresses, missing Helius configuration, rate limits, and wallets with no history or swaps.

P&L is based on swap legs reported by Helius. SOL and wrapped SOL are quote currency. USD values are calculated only where both the acquisition and sale have an observed USDC or USDT leg; no historical SOL/USD price is guessed. Transfers enter inventory with unknown cost basis and do not count as trades. Network and protocol fees are not allocated to token lots. These limitations are included in the API response so downstream screens can disclose incomplete values.

Successful wallet analyses are cached by public address in Next.js's Data Cache for 10 minutes. The dashboard includes a cumulative realized SOL chart, close-based statistics, three generated insights, a per-token ledger, and a branded share card generated with Next.js `ImageResponse` (powered by `@vercel/og`).

## Deployment

Deploy the repository to Vercel and configure `HELIUS_API_KEY` in the project environment variables.

## Disclaimer

Degenstats provides analytics only and is not financial advice. On-chain history and token pricing may be incomplete.
