# 🌿 Arbor

**Pay for what you watch. Nothing more.**

Arbor is a premium streaming platform for independent, short, festival, and
Creative Commons films — with no subscriptions. Viewers buy flexible viewing
time (2.5h / 5h / 10h) and the meter runs **only while the film plays**.
Pausing, browsing, and trailers are always free. Filmmakers earn per second
watched and get paid on-chain — instantly, transparently, pro-rata.

Think *prepaid mobile data, but for cinema*.

The blockchain is completely invisible: sign in with Google, a Particle
Universal Account is created silently, and every transaction is gasless on
Arbitrum. No seed phrases. No "connect wallet". No crypto vocabulary.

Built in 7 days for the [Encode Club UXMaxx Hackathon](https://www.encodeclub.com/programmes/uxmaxx-hackathon).

## Why this needs a blockchain

Card networks can't settle $0.08 for 3 minutes of viewing — processor fees
exceed the charge. A prepaid balance with programmable micro-debits and
instant creator payouts is only economical with account abstraction.
Crypto is the enabler, never the product.

## How it works

```text
Sign in with Google  →  Universal Account created silently (Particle)
Buy a time package   →  gasless USDC purchase on Arbitrum (on-chain)
Watch films          →  seconds debited off-chain, only while playing
Pause / browse       →  free, always
Session ends         →  filmmakers settled on-chain, pro-rata by seconds watched
Gift time            →  send viewing hours to a friend via a single-use claim link
```

On-chain is reserved for the money moments — purchase in, settlement out.
Everything in between lives in a server-side ledger. Transactions are never
streamed per second.

## Features

- 🎬 **Netflix-grade streaming UX** — cinematic catalog, dark theme
- ⏱️ **Pay-per-viewing-time** — the meter runs only during playback; pause is free
- 🧘 **Anti-anxiety metering** — a calm remaining-time gauge
- 👋 **Zero-crypto onboarding** — Google login, silent wallet creation, gasless everything
- 🎁 **Gift time** — transfer viewing hours from your balance to a friend
- 🎥 **Filmmaker Studio** — live per-second earnings and on-chain settlement proof (Arbiscan)

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript |
| Wallet & Auth | Particle Network — Universal Accounts, social login, gasless paymaster, EIP-7702 path |
| Chain | Base Sepolia (testnet) |
| Contract | `ArborVault.sol` — package purchase + batch filmmaker settlement |
| Ledger | Postgres — balances, sessions, debit events, gift claims, settlements |
| Content | Blender Foundation & public-domain films (fully licensed-safe catalog) |

## Catalog

All demo content is legally redistributable: Blender Foundation open movies
(*Sintel*, *Big Buck Bunny*, *Tears of Steel*, *Elephants Dream*) and
public-domain classics. Positioning: independent cinema, short films, and
festival selections — the films streaming giants ignore.

## Project status

MVP Created. See [PLANNING.md](PLANNING.md) for the full
product planning document: vision, personas, UX strategy, architecture,
business logic, risks, team plan, and demo flow.

## Team

3 builders, 7 days:

- **A — Frontend + Backend:** design system, catalog, player, metering UX, motion
- **B — Backend + DB:** ledger, heartbeat API, Studio API, gift API, content pipeline
- **C — Web3:** `ArborVault.sol`, Particle integration, gasless purchase, settlement pipeline

---

*Encode Club UXMaxx Hackathon · Particle Network · Arbitrum*
