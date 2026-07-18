import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ── Auth accounts (email + password hash, self-contained — no external auth service) ──
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull().default(""),
    walletAddress: text("wallet_address").notNull().default("0x0000000000000000000000000000000000000000"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("accounts_email_unique").on(t.email)],
);

// Ledger integrity rules (ARCHITECTURE.md §5, §8):
// - balance_seconds is always recomputable from purchases + gifts − debit_events
// - every balance mutation happens inside one ACID transaction
// - the client never computes balances; it only displays server responses

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    particleUuid: text("particle_uuid").notNull().unique(),
    // fallback email/password identity — set when the ledger row was
    // lazy-created from an accounts login instead of a Particle sign-in
    accountId: uuid("account_id").references(() => accounts.id),
    walletAddress: text("wallet_address").notNull(),
    balanceSeconds: integer("balance_seconds").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Stored as "0" / "1" text (not boolean) — matches the pre-existing
    // column in the DB. Gates the Studio page: Filmmaker Dashboard vs
    // Creator Application flow.
    isFilmmaker: text("is_filmmaker").default("0"),
  },
  (t) => [
    // §8 "Rate abuse": balance can't go negative — enforced in the schema
    // itself, same principle as one-active-session below (not app-code-only)
    check("balance_seconds_non_negative", sql`${t.balanceSeconds} >= 0`),
    // one ledger row per fallback account
    uniqueIndex("users_account_id_unique")
      .on(t.accountId)
      .where(sql`${t.accountId} is not null`),
  ],
);

export const filmmakers = pgTable(
  "filmmakers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    walletAddress: text("wallet_address").notNull(),
    // accrued, unsettled earnings in USDC cents (90% share, accrued per debit)
    pendingCents: integer("pending_cents").notNull().default(0),
    // Links a filmmaker row to the account that owns it. NULL for the
    // originally-seeded catalog filmmakers (Blender Foundation, etc.) — only
    // auto-provisioned filmmakers (lib/services/filmmaker.service.ts) have
    // this set. Nullable + unique so one user maps to at most one filmmaker.
    userId: uuid("user_id").references(() => users.id),
    bio: text("bio"),
    country: text("country"),
    genre: text("genre"),
  },
  (t) => [
    uniqueIndex("filmmakers_user_id_unique")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
  ],
);

export const films = pgTable("films", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  synopsis: text("synopsis").notNull(),
  category: text("category").notNull(),
  year: integer("year").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  videoUrl: text("video_url").notNull(),
  posterUrl: text("poster_url").notNull(),
  filmmakerId: uuid("filmmaker_id")
    .notNull()
    .references(() => filmmakers.id),
});

export const playbackSessions = pgTable(
  "playback_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    // monotonic heartbeat sequence — replayed/reordered beats are rejected
    lastSeq: integer("last_seq").notNull().default(0),
    lastBeatAt: timestamp("last_beat_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // set when the session is actually closed — distinct from lastBeatAt,
    // which only reflects the last heartbeat received
    endedAt: timestamp("ended_at", { withTimezone: true }),
    // set when the session's debit_staging rows have been rolled up into one
    // permanent debit_events audit row. NULL = not yet audited. This is the
    // idempotency guard: rollup only acts on rows where audited_at IS NULL.
    auditedAt: timestamp("audited_at", { withTimezone: true }),
  },
  (t) => [
    // single active session per user, enforced by the schema itself
    uniqueIndex("one_active_session_per_user")
      .on(t.userId)
      .where(sql`${t.active} = true`),
  ],
);

// Hot staging tier for heartbeats. Every beat appends one row here (cheap,
// bounded, replay-proof); rows are rolled up into debit_events when the
// session closes and purged after 7 days. This keeps the permanent audit
// table (debit_events) growing per-session instead of per-10s-beat.
export const debitStaging = pgTable(
  "debit_staging",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => playbackSessions.id),
    // monotonic per-session beat number — see playback_sessions.last_seq
    seq: integer("seq").notNull(),
    seconds: integer("seconds").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // (session, seq) is the natural key — a replayed beat collides and is
    // dropped by ON CONFLICT, so double-billing is impossible by construction
    primaryKey({ columns: [t.sessionId, t.seq] }),
    // drives the 7-day TTL purge sweep
    index("debit_staging_created_idx").on(t.createdAt),
  ],
);

export const debitEvents = pgTable(
  "debit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => playbackSessions.id),
    seconds: integer("seconds").notNull(),
    // filmmaker's 90% share of this debit, in USDC cents
    filmmakerCents: integer("filmmaker_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // ARCHITECTURE.md §5 Indexing: "debit_events (session_id, created_at)
    // for Studio queries" — was missing entirely
    index("debit_events_session_created_idx").on(t.sessionId, t.createdAt),
  ],
);

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  // UNIQUE — replaying the same on-chain purchase can never double-credit
  txHash: text("tx_hash").notNull().unique(),
  packageId: text("package_id").notNull(),
  seconds: integer("seconds").notNull(),
  cents: integer("cents").notNull(),
  // pending → confirmed → failed; tracks on-chain deposit status
  status: text("status").notNull().default("pending"),
  // set when the on-chain deposit is confirmed
  blockNumber: integer("block_number"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const giftClaims = pgTable("gift_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  recipientId: uuid("recipient_id").references(() => users.id),
  // SHA-256 of the claim token; the raw token exists only in the share link
  tokenHash: text("token_hash").notNull().unique(),
  seconds: integer("seconds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
});

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  // pending → confirmed; a crash between chain-send and confirm is
  // recovered by the retry sweep (ARCHITECTURE.md §4.3)
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const settlementItems = pgTable("settlement_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  settlementId: uuid("settlement_id")
    .notNull()
    .references(() => settlements.id),
  filmmakerId: uuid("filmmaker_id")
    .notNull()
    .references(() => filmmakers.id),
  cents: integer("cents").notNull(),
  // filmmaker's wallet address at time of settlement snapshot
  walletAddress: text("wallet_address").notNull().default(""),
  // pending → paid; updated when CreatorPaid event is confirmed
  status: text("status").notNull().default("pending"),
});

// Creator ("Apply as Creator") applications submitted from the Studio page.
// This mirrors the pre-existing `applications` table exactly (introspected from
// the DB — NOT created by drizzle-kit push). Notable: id is a serial, user_id
// is NOT NULL (a session is required to apply), the yes/no answers are stored
// as short varchars (not booleans), and every varchar has a length cap the
// Server Action clamps to. id and the timestamps are DB-managed — the client
// never supplies them.
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  // ── required ──
  fullName: varchar("full_name", { length: 400 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  country: varchar("country", { length: 60 }).notNull(),
  // "yes" | "no" — stored as varchar(10), not a boolean column
  hasReleasedWorkBefore: varchar("has_released_work_before", {
    length: 10,
  }).notNull(),
  experience: varchar("experience", { length: 20 }).notNull(),
  // "yes" | "no" — stored as varchar(10), not a boolean column
  holdsFullRights: varchar("holds_full_rights", { length: 10 }).notNull(),
  applicantType: varchar("applicant_type", { length: 30 }).notNull(),
  paymentWalletAddress: varchar("payment_wallet_address", {
    length: 100,
  }).notNull(),
  // ── optional ──
  portfolioLinks: text("portfolio_links"),
  previousFilmsLink: text("previous_films_link"),
  previousAwardsLink: text("previous_awards_link"),
  shortBio: text("short_bio"),
  consideredGenre: varchar("considered_genre", { length: 200 }),
  coOwnerFullName: varchar("co_owner_full_name", { length: 400 }),
  closingStatement: text("closing_statement"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});