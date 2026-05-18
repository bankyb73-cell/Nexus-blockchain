/**
 * Transaction module — creates, validates, and manages the mempool.
 */

import { createHash } from "node:crypto";
import { TOKEN } from "./constants.js";
import { buildSigningPayload, verifyAddressOwnership, verifySignature } from "./wallet.js";
import type { Transaction } from "./types.js";

/**
 * Compute a stable transaction ID from its fields.
 */
export function computeTransactionId(tx: Omit<Transaction, "id">): string {
  const data = JSON.stringify({
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    fee: tx.fee,
    timestamp: tx.timestamp,
    type: tx.type,
  });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Create a genesis/coinbase transaction for the initial token allocations.
 * These are unsigned — they originate from the protocol itself.
 */
export function createGenesisTransaction(
  to: string,
  amount: number,
  timestamp: number
): Transaction {
  const partial: Omit<Transaction, "id"> = {
    from: null,
    to,
    amount,
    fee: 0,
    signature: null,
    publicKey: null,
    timestamp,
    type: "genesis",
  };
  return { id: computeTransactionId(partial), ...partial };
}

/**
 * Create a block reward transaction for a miner.
 * Unsigned — protocol-issued.
 */
export function createRewardTransaction(
  minerAddress: string,
  rewardAmount: number,
  timestamp: number
): Transaction {
  const partial: Omit<Transaction, "id"> = {
    from: null,
    to: minerAddress,
    amount: rewardAmount,
    fee: 0,
    signature: null,
    publicKey: null,
    timestamp,
    type: "reward",
  };
  return { id: computeTransactionId(partial), ...partial };
}

/**
 * Build a pending transaction object (not yet signed).
 * Caller must sign it with signTransaction from wallet.ts and attach signature/publicKey.
 */
export function buildTransaction(params: {
  from: string;
  to: string;
  amount: number;
  timestamp?: number;
}): { tx: Omit<Transaction, "id" | "signature" | "publicKey">; payload: string } {
  const timestamp = params.timestamp ?? Date.now();
  const fee = Math.ceil(params.amount * TOKEN.TRANSACTION_FEE_RATE * 1e8) / 1e8;

  const partial = {
    from: params.from,
    to: params.to,
    amount: params.amount,
    fee,
    timestamp,
    type: "transfer" as const,
  };

  const payload = buildSigningPayload({
    from: params.from,
    to: params.to,
    amount: params.amount,
    fee,
    timestamp,
  });

  return { tx: partial, payload };
}

/**
 * Finalize a signed transaction and compute its ID.
 */
export function finalizeTransaction(
  partial: Omit<Transaction, "id" | "signature" | "publicKey">,
  signature: string,
  publicKey: string
): Transaction {
  const withSig: Omit<Transaction, "id"> = { ...partial, signature, publicKey };
  return { id: computeTransactionId(withSig), ...withSig };
}

/**
 * Validate a signed transfer transaction.
 * Returns null if valid, or an error message string.
 */
export function validateTransaction(
  tx: Transaction,
  getBalance: (address: string) => number
): string | null {
  if (tx.type !== "transfer") return null; // genesis/reward are protocol-issued

  if (!tx.from || !tx.signature || !tx.publicKey) {
    return "Transaction missing required fields (from, signature, publicKey)";
  }

  if (tx.amount <= 0) return "Amount must be positive";
  if (tx.fee < 0) return "Fee cannot be negative";

  // Verify the public key matches the from address
  if (!verifyAddressOwnership(tx.from, tx.publicKey)) {
    return "Public key does not match sender address";
  }

  // Verify signature
  const payload = buildSigningPayload({
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    fee: tx.fee,
    timestamp: tx.timestamp,
  });

  if (!verifySignature(tx.publicKey, payload, tx.signature)) {
    return "Invalid transaction signature";
  }

  // Check balance
  const balance = getBalance(tx.from);
  if (balance < tx.amount + tx.fee) {
    return `Insufficient balance: has ${balance}, needs ${tx.amount + tx.fee}`;
  }

  return null;
}
