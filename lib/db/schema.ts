import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Ledger integrity rules (ARCHITECTURE.md §5, §8):
// - balance_seconds is always recomputable from purchases + gifts − debit_events
// - every balance mutation happens inside one ACID transaction
// - the client never computes balances; it only displays server responses

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  particleUuid: text("particle_uuid").notNull().unique(),
  walletAddress: text("wallet_address").notNull(),
  balanceSeconds: integer("balance_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const filmmakers = pgTable("filmmakers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  // accrued, unsettled earnings in USDC cents (90% share, accrued per debit)
  pendingCents: integer("pending_cents").notNull().default(0),
});

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
  },
  (t) => [
    // single active session per user, enforced by the schema itself
    uniqueIndex("one_active_session_per_user")
      .on(t.userId)
      .where(sql`${t.active} = true`),
  ],
);

export const debitEvents = pgTable("debit_events", {
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
});

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
});
