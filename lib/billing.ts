// Central billing constants so the sign-in, Particle-verify, and heartbeat
// paths can't drift out of agreement.

// TODO(purchase-flow): remove once /api/purchase/confirm credits real
// on-chain purchases. Until then every freshly-created ledger user (either
// login method) gets 1h of dev credit so the heartbeat path is testable.
export const DEV_SEED_BALANCE_SECONDS = 3600;

// Server-clock delta cap per heartbeat: 10s interval + 2s network tolerance
// (ARCHITECTURE.md §4.1 / §8 "Heartbeat inflation/replay").
export const MAX_HEARTBEAT_DELTA_SECONDS = 12;
