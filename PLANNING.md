# ARBOR — Product Planning Document

> Premium streaming for independent cinema. Pay only for time actually watched.
>
> Encode Club UXMaxx Hackathon — built with Particle Network Universal Accounts on Arbitrum.

**Pitch anchor:** *"Prepaid mobile data, but for cinema."*

---

## 1. Product Vision

A Netflix-grade streaming experience for independent, short, festival, and Creative Commons films — where viewers buy flexible viewing time instead of subscriptions, and filmmakers earn per second watched, settled transparently on-chain. Blockchain is fully invisible to the end user.

## 2. Problem Statement

- **Viewers:** subscriptions monetize calendar time, not consumption. A casual viewer pays for 30 days and watches 4 hours. Cancel/resubscribe friction punishes honest usage.
- **Filmmakers:** independent films earn almost nothing after the festival circuit. Streaming platforms pay opaque, delayed, aggregated royalties — when they accept the film at all.
- **Why this is unsolved:** card rails cannot economically settle $0.08 for 3 minutes of viewing (processor fees exceed the charge). A prepaid balance with programmable micro-debits and instant programmable payouts is only viable with account abstraction. Crypto is the enabler — never the product.

## 3. Personas

| Persona | Who | Need | Arbor answer |
|---|---|---|---|
| **Casual Casey** | Watches 3–5 h/month, subscription-fatigued | Pay fairly, zero commitment | Buy 2.5 h, use whenever |
| **Film-buff Farah** | Loves festival/indie cinema, can't find it | Curated catalog, discovery | Indie-only positioning |
| **Filmmaker Miko** | Short-film director, no revenue path | Get paid, see real numbers | Per-second earnings, instant settlement |
| **Judge Jay** | UXMaxx judge, has seen 12 wallet demos today | Comprehend in 5 seconds | "Oh, it's Netflix — but pay-per-watch" |

## 4. Jobs To Be Done

- Viewer: *"When I want a film tonight, help me watch instantly without committing to a subscription, so I only pay for entertainment I consume."*
- Viewer: *"When I pause or browse, don't charge me, so payment feels fair."*
- Viewer: *"When a friend would love this platform, let me send them viewing time, so sharing is one tap."*
- Filmmaker: *"When people watch my film, show me exactly what I earned and pay me now, so I trust the platform."*

## 5. Value Proposition

Two-sided fairness from one mechanic:

- **Viewer:** the meter runs only while the film plays. Pause, browse, trailers — free.
- **Filmmaker:** earn exactly what's watched, pro-rata by seconds, settled on-chain.

No incumbent offers either side.

## 6. User Stories (MVP)

1. As a visitor, I browse the full catalog, watch trailers, and read details — free, no account.
2. As a new user, I sign in with Google; my account and wallet are created silently (no seed phrase, no "wallet" vocabulary).
3. As a user, I buy a time package (2.5 h / 5 h / 10 h) in one tap — gasless.
4. As a viewer, I play any film; time debits only while playing; pause/seek/browse are free.
5. As a viewer, I see remaining time as a calm gauge (pause overlay + header pill), never a ticking money counter.
6. As a viewer, I move between films freely — no per-title purchase.
7. As a user with balance, I gift viewing time to a friend via a single-use claim link.
8. As a filmmaker, I see live earnings per film and settlement history with on-chain proof links.
9. As a power user, I can optionally connect my existing wallet (EIP-7702 upgrade path). *(stretch)*

## 7. Feature Prioritization

- **P0 (demo dies without):** catalog UI · player + time metering · Google login → Particle Universal Account · package purchase (gasless USDC, Arbitrum Sepolia) · balance gauge · filmmaker earnings view + visible settlement tx.
- **P1 (strong demo):** trailers · pause-overlay meter design · recommendation rows · session-end settlement trigger · Arbiscan link in Studio.
- **P1.5:** gift time (balance-funded transfer, claim link). Built day 5; first thing cut if day 4 slips.
- **P2 (if time):** connect-existing-wallet · captions · search.
- **Cut (explicit no):** comments/reviews, ratings, profiles, recommendation engine, moderation, upload flow, mobile apps, mainnet.

## 8. Information Architecture & Navigation

```text
/                → Home: hero film + rows (Featured, Shorts, Festival, Animation)
/film/[slug]     → Detail: poster art, synopsis, trailer (free), runtime, cost hint, Play
/watch/[slug]    → Player (fullscreen-first, custom controls, meter)
/time            → Time wallet: balance, packages, purchase history, gift time
/gift/[token]    → Claim page for gifted time
/studio          → Filmmaker view: earnings per film, live counter, settlements + tx links
(auth modal)     → Continue with Google | Continue with wallet (secondary)
```

Flat, 6 destinations. Top nav: logo, Browse, time pill (e.g. `3h 41m`), avatar. The words "wallet", "crypto", "gas", "chain" never appear in viewer UI. Studio is a separate mode reached via the avatar menu.

## 9. UX Strategy

- **5-second comprehension:** the homepage must read as premium streaming instantly. Cinematic hero, poster rows, dark theme.
- **Anti-anxiety metering (signature design problem):**
  - During playback: nothing visible. Zero meter.
  - Hover/pause: gentle overlay — "3h 12m remaining · this film ≈ 24m".
  - Header pill always shows remaining time, muted; never turns urgent until < 15 min.
  - Low balance: soft top-up prompt at a natural pause, never a mid-scene interruption; playback never hard-stops without a 2-minute warning.
- **Cost preview before commitment:** the detail page shows "≈ 96 min of your time" so there are no surprises.
- **Zero crypto vocabulary in onboarding.** The post-purchase receipt says "2.5 hours added", not a tx hash. (The hash is accessible in purchase history for the curious — trust, not noise.)

## 10. Business Logic

- Time wallet stored in **seconds**; server-side ledger is the source of truth.
- Debit rule: only confirmed playback progress (player `timeupdate` deltas batched via heartbeat every 10 s). Buffering doesn't advance playback → never charged. Pause/seek/browse → no debit.
- Trailers: always free. Rewatch: charged (time-based model, consistent).
- One active playback session per account (blocks trivial account sharing).
- Filmmaker accrual: each debited second accrues pro-rata to that film's filmmaker at (rate − platform fee).
- **Gift rule:** gifting transfers from the sender's *existing* balance only — no purchase-for-other, no negative balance. Atomic operation: debit sender + mint single-use claim token in one transaction. Recipient signs in with Google and the time is waiting.

## 11. Monetization

- Packages (testnet USDC in demo): **2.5 h = $2.49 · 5 h = $4.49 · 10 h = $7.99**.
- Platform take: **10%** of watch-spend; **90%** accrues to the filmmaker, applied at accrual time.
- Future: festival partnerships, promoted placement, filmmaker analytics tier.

## 12. Technical Architecture

```text
Next.js (App Router, TS) ── one repo, one deploy (Vercel)
│
├─ Viewer UI + Studio UI (React, Tailwind, custom player over <video>/hls.js)
├─ API routes: /api/session/heartbeat · /api/packages/purchase · /api/gift · /api/gift/claim
│              /api/studio/earnings · /api/settle
├─ Neon Postgres + Drizzle (neon-http driver): users, balances, films, sessions, debit_events,
│                                              gift_claims, settlements — see ARCHITECTURE.md
│
├─ Particle Network
│   ├─ Auth: social login → Universal Account (embedded, invisible)
│   ├─ Gasless: paymaster sponsors all user transactions
│   └─ EIP-7702 path for existing-wallet users (stretch)
│
├─ Arbitrum Sepolia
│   └─ ArborVault.sol (one small contract):
│        purchase(packageId)                          — pulls test-USDC, emits PackagePurchased
│        settle(address[] filmmakers, uint[] amounts) — owner (backend) batch payout, emits Settled
│
└─ Content: Blender Foundation + public-domain films, MP4 on Cloudflare R2 (zero egress), ~6–8 titles
```

- **On-chain = money moments only:** purchase in, settlement out. Everything in between lives in the server ledger. Never stream transactions.
- Settlement trigger: production = daily cron; demo = session-end / manual "settle" in Studio → live Arbiscan proof.

## 13. Backend / Frontend / API Responsibilities

- **Backend:** ledger integrity, heartbeat validation (session token, monotonic timestamps, max delta = heartbeat interval — reject inflated claims), gift atomicity, settlement batching, contract owner key (env, server-only).
- **Frontend:** never trusts itself for balance; displays server state. Player emits heartbeats; server responds with remaining balance → gauge stays honest.
- **API:** thin REST via route handlers. No public API surface for MVP. All viewer-visible errors humanized ("Playback hiccup — your time wasn't charged").

## 14. Design System Strategy

- **Brand:** Arbor — organic, grows-from-attention metaphor. Dark cinema base (`#0C0F0D` near-black green), deep forest green primary, warm amber accent (projector light), off-white text. Logo: minimal tree/play-triangle hybrid (P1 nicety).
- Tokens first (colors, spacing, radius, type scale) → components: Button, Card, Row, Pill, Gauge, Modal, PlayerControls. Tailwind + CVA, no heavy UI library — visual identity is a judged surface.
- Type: serif display for film titles (cinematic), clean sans for UI.

## 15. Motion Strategy

Motion = meaning. Three signature moments only:

1. **Time added:** gauge fills with an organic ease + subtle leaf/branch flourish (brand moment).
2. **Play transition:** detail → player cinematic expand.
3. **Studio earnings tick:** counter increments smoothly as heartbeats land (the "money shot" for judges).

Everything else: 150–200 ms standard eases. `prefers-reduced-motion` respected globally.

## 16. Accessibility

Keyboard-complete player (space, arrows, F, M) · visible focus states · WCAG AA contrast (audit amber-on-dark) · captions for the hero demo film at minimum · ARIA labels on gauge/meter ("3 hours 12 minutes remaining") · reduced-motion support. Built into components from day 1.

## 17. Internationalization

English-only MVP. Strings via a constants file (not hardcoded in JSX) → next-intl drop-in later. No further i18n work in the hackathon window.

## 18. Security Considerations

- Heartbeat forgery = free watching → server validates session token, interval bounds, single active session.
- Gift claims: single-use tokens, atomic debit+mint, sender balance validated server-side.
- Contract owner key server-side only; contract holds test funds only; mainnet audit is a future item.
- No card data, no passwords stored (social auth + Particle custody model).
- Balance mutations happen server-side exclusively; the client displays, never computes.

## 19. Risks / Assumptions / Unknowns

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Particle SDK surprises (docs gaps, testnet quirks) | HIGH | Day-1 spike: login + gasless tx before anything else |
| 2 | Live demo network/testnet failure | HIGH | Full backup screen recording; local fallback env; rehearse twice |
| 3 | Scope creep (streaming platforms are bottomless) | HIGH | P0 list is a contract; anything new goes to Future |
| 4 | Metering feels wrong (charges while paused, gauge desync) | MED | Day-3 internal dogfood; this bug = demo death, test hardest |
| 5 | Video hosting bandwidth/cost | LOW | 6–8 films, 720p cap, Blob/R2 sufficient |

**Assumptions:** Particle supports Arbitrum Sepolia + gasless there (verify day 1); test-USDC obtainable; 3 devs available all 7 days.

**Open items:** balance expiry policy (future roadmap, per decision — never-expires favored but deferred).

## 20. MVP / Stretch / Hackathon Scope

- **MVP = P0 + P1 + gift (P1.5).** Demoable end of day 5.
- **Stretch:** connect-existing-wallet (EIP-7702 story for judges), captions, search.
- **Explicit future (say in pitch, don't build):** mainnet, real filmmaker onboarding, expiry policy, mobile, recommendations, moderation, fiat on-ramp.

## 21. Team Plan — 3 people × 7 days

- **A — Frontend + Backend:** design tokens, catalog, detail page, player + meter UX, motion, gift UI, deck visuals.
- **B — Backend + DB:** schema, heartbeat/debit ledger, Studio API, gift/claim API, content pipeline (encode films, posters, metadata), README/docs.
- **C — Web3:** ArborVault.sol + deploy + tests, Particle Auth + Universal Account + gasless integration, settlement pipeline, Arbiscan links, architecture slide.

Boundary: C ships hooks (`useArborAccount()`, `usePurchase()`); A consumes them in UI. C never touches layout; A never touches SDK config.

```text
Day 1  A: tokens+shell      C: SPIKE Particle login+gasless (Sepolia)   B: schema+seed films
Day 2  A: catalog+detail    C: ArborVault + purchase hook               B: heartbeat/debit API
Day 3  A: player+meter      C: purchase E2E on Sepolia                  B: ledger hardening + Studio API
Day 4  ── integration: login→buy→watch→debit→accrue, all hands ──
Day 5  A: motion+gift UI    C: settlement + Arbiscan                    B: Studio UI + gift API + docs
Day 6  bugfix · pitch deck · rehearsal #1
Day 7  buffer · backup recording · rehearsal #2 · submit
```

**Rules:** Day 4 slips → cut gift, then stretch. Never slip day 6.

## 22. Demo Flow (~5 min live)

1. **(0:00) Cold open:** homepage on screen. Silence for 3 seconds. Judges think "Netflix." Then: *"This is Arbor. Independent cinema. And no subscription exists here."*
2. **(0:30) Onboard:** Continue with Google → in. *"An account was just created — and a Universal Account with it. Nobody saw a seed phrase."*
3. **(1:00) Buy:** 2.5 h package, one tap, gasless. *"Card networks can't settle what comes next. This can."*
4. **(1:30) Watch:** play film → pause → gauge frozen → browse to a second film freely. *"Time only moves when the film does. Prepaid data, for cinema."*
5. **(3:00) Gift:** send 1 h to a friend via claim link. *"Try that with your Netflix subscription."*
6. **(3:30) Studio flip:** earnings counter ticking per second watched → end session → **settlement tx → Arbiscan live**. *"The filmmaker just got paid for exactly what you watched. Tonight. Not next quarter."*
7. **(4:30) Close:** one architecture slide (Particle + Arbitrum + 7702 path), future line, done.

**Deliverables:** live demo · PPT ≤ 8 slides (problem, mechanic, live demo, architecture, why-only-possible-with-AA, future) · GitHub repo with README (architecture diagram, setup, `.env.example`) + short ADRs (why prepaid-debit vs streaming money, why Sepolia, why heartbeats).
