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

## Deployment

Deploy the repository to Vercel and configure `HELIUS_API_KEY` in the project environment variables.

## Disclaimer

Degenstats provides analytics only and is not financial advice. On-chain history and token pricing may be incomplete.
