// ArborVault contract ABI — deployed on Arbitrum Sepolia at
// 0xde517DED369a3Af43bbb4F677e33Fd26b37C1833
//
// Functions: deposit (user purchase), releaseBatch (settlement)
// Events: PaymentReceived, CreatorPaid, BatchReleased

export const arborVaultAbi = [
  // ── Read functions ──────────────────────────────────────────────────
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usdcToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "orderFulfilled",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  // ── Write functions ─────────────────────────────────────────────────
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "orderId", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "releaseBatch",
    inputs: [
      { name: "settlementId", type: "bytes32" },
      {
        name: "items",
        type: "tuple[]",
        components: [
          { name: "wallet", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ── Events ──────────────────────────────────────────────────────────
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "orderId", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CreatorPaid",
    inputs: [
      { name: "settlementId", type: "bytes32", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BatchReleased",
    inputs: [
      { name: "settlementId", type: "bytes32", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "totalRecipients", type: "uint256", indexed: false },
    ],
  },
] as const;
