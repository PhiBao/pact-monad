# Pact — money only moves if the group means it

Conditional group pots on Monad. Track: **Consumer Products & Payments**.

**Problem.** The informal organizer fronts the Airbnb, the dinner bill, the gift —
then chases friends across 4 Venmo reminders. Half pay late, some never do.

**Product.** Start a pot (amount/person, group size, deadline), share the link.
Friends join with **Face ID** (Mera passkey, no seed phrase) and commit their share
into non-custodial escrow. If the group fills before the deadline → organizer is
paid automatically (**TILTED**). If not → everyone claims a refund. **No tilt, no charge.**

## Why Monad (genuine advantage, not sticker)

- 400ms blocks / 600ms finality: commits appear instantly — the live progress bar
  is the social-pressure engine.
- ~$0.0001 actions: $5–$50 micro-commits are viable (impossible on L1 gas).
- P256 precompile + Mera: FaceID EOAs, no contracts/bundlers, portable via BIP-44.
- AUSD (LayerZero OFT, native on Monad): dollar-denominated pots; cross-chain
  contributors bring the same dollar.
- Envio HyperSync/HyperIndex: realtime pot feed (`indexer/`).

## Repo

- `contracts/` — `PactFactory` (EIP-1167 clone factory, 1% default fee, capped 5%)
  + `PactPot` (commit / release / expire / refund, pull-pattern refunds,
  ReentrancyGuard, no organizer pre-tilt withdraw). `forge test`: 7/7 green.
- `app/` — Next.js 15 PWA (pnpm, TypeScript, viem/wagmi). FaceID via
  `@category-labs/mera` + direct viem write path; wallet-app fallback via wagmi.
- `indexer/` — Envio config + schema (factory wired for testnet 10143 + mainnet 143).
- `app/app/api/assist/` — TypeSafe (Jev) judgments, server-side: `parse` turns one
  sentence into a pot draft (Choice: occasion/currency/deadline; regex in code for
  amounts; confidence-gated review flags), `score` returns a legitimacy Noul for
  the feed badge. Verified live: "cabin weekend…" → trip/3d/80/6; giveaway scam → p=0.01.

## Deployed (Sourcify `exact_match` both chains)

Factory (v2: onchain fee, pot titles) — testnet
`0x4f6aD063f1c20D53a4ea4FA1ba46A8783C782D16`, mainnet
`0xEF673BDac2C86506874919b1ad05Bd7D7fa64344`, both Sourcify `exact_match`.
Live pots: testnet "Cabin weekend" + "Demo night out"
(`0xD727…960307`, 3×0.5 MON — use for the demo tilt).

## Run

```bash
# contracts
cd contracts && forge test

# app (needs NEXT_PUBLIC_FACTORY_ADDRESS; NEXT_PUBLIC_CHAIN=testnet|mainnet)
cd app && pnpm install && pnpm dev
```

## Demo (3 min)

1. "Who fronted a trip and got ghosted?" 2. Organizer creates 3×0.5 MON pot,
   shares link. 3. Two phones FaceID-commit live (<1s each). 4. Third commits →
   TILTED + release tx on explorer. 5. Second pot expires → refund claimed live.
   6. "Splitwise records debt. Pact prevents it."

## Bounty stack

Mera UX + One-Passkey-Many-Keys · Dynamic (email/social embedded wallets) ·
Envio · Agora (AUSD pots).

## Auth paths (all three live)

1. **Face ID** — Mera passkey EOAs, no seed phrase (`lib/mera.ts` + `lib/pactWrite.ts`).
2. **Email/social** — Dynamic embedded wallets synced into wagmi
   (`lib/wagmi.tsx`, `components/DynamicLogin.tsx`). Dashboard must have:
   Monad 143 + 10143 enabled under Chains & Networks; email/social sign-in on;
   Embedded Wallets on; CORS allowlist includes localhost + the Vercel URL.
3. **Wallet app** — injected connector fallback.

## Deploy (Vercel)

Root is gitignored for secrets (`.env` never committed). Push to GitHub, import
`app/` as a Next.js project, set env: `NEXT_PUBLIC_CHAIN=testnet`,
`NEXT_PUBLIC_FACTORY_ADDRESS=0x6792E51FBD24f9315282BD5b6c5E713dCc779C69`,
`NEXT_PUBLIC_DYNAMIC_ENV_ID=a8d97ee6-984e-48df-9de3-61a68f14ed55`,
`TYPESAFE_API_KEY` (server-only), `NEXT_PUBLIC_AUSD_ADDRESS` when used.
