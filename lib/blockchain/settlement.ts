// High-level settlement orchestration on the blockchain side.
// This module ties together the ArborVault contract calls with
// transaction confirmation. Business logic (DB reads/writes) lives
// in lib/services/settlement.service.ts.

export {
  releaseBatch,
  getVaultBalance,
  isOrderFulfilled,
  type ReleaseItem,
} from "./arborVault";

export {
  getPaymentReceivedFromTx,
  getBatchReleasedFromTx,
  getCreatorPaidFromTx,
} from "./events";
