/**
 * Blockchain core — Proof of Work consensus, chain validation, balance tracking.
 */

import { computeBlockHash } from "./genesis.js";
import { MINING } from "./constants.js";
import { createRewardTransaction } from "./transaction.js";
import type { Block, Transaction } from "./types.js";

/** Mining reward per block (decreases over time; start at 10 NXC) */
const BLOCK_REWARD = 10;

/**
 * Compute the current mining target string (leading zeros).
 */
export function miningTarget(difficulty: number): string {
  return "0".repeat(difficulty);
}

/**
 * Mine a new block: repeatedly increment the nonce until the hash meets difficulty.
 * This is single-threaded PoW — in production, this would run in a worker thread.
 */
export function mineBlock(
  previousBlock: Block,
  transactions: Transaction[],
  minerAddress: string,
  difficulty: number
): Block {
  const timestamp = Date.now();
  const target = miningTarget(difficulty);

  // Miner earns the block reward + all transaction fees
  const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0);
  const rewardTx = createRewardTransaction(minerAddress, BLOCK_REWARD + totalFees, timestamp);

  const blockTransactions = [rewardTx, ...transactions];

  let nonce = 0;
  let hash: string;
  let partial: Omit<Block, "hash">;

  do {
    partial = {
      index: previousBlock.index + 1,
      timestamp,
      transactions: blockTransactions,
      previousHash: previousBlock.hash,
      nonce,
      difficulty,
      minedBy: minerAddress,
    };
    hash = computeBlockHash(partial);
    nonce++;
  } while (!hash.startsWith(target));

  return { ...partial, hash };
}

/**
 * Re-compute and verify a single block's hash is valid.
 */
export function isValidBlock(block: Block, previousBlock: Block): boolean {
  // Index must be sequential
  if (block.index !== previousBlock.index + 1) return false;

  // previousHash must match
  if (block.previousHash !== previousBlock.hash) return false;

  // Hash must be correct
  const expected = computeBlockHash({
    index: block.index,
    timestamp: block.timestamp,
    transactions: block.transactions,
    previousHash: block.previousHash,
    nonce: block.nonce,
    difficulty: block.difficulty,
    minedBy: block.minedBy,
  });
  if (expected !== block.hash) return false;

  // Hash must meet difficulty
  if (!block.hash.startsWith(miningTarget(block.difficulty))) return false;

  return true;
}

/**
 * Validate the entire chain from genesis onwards.
 * Returns true if every block is valid.
 */
export function isValidChain(chain: Block[]): boolean {
  if (chain.length === 0) return false;

  // Validate each block after genesis
  for (let i = 1; i < chain.length; i++) {
    if (!isValidBlock(chain[i]!, chain[i - 1]!)) return false;
  }
  return true;
}

/**
 * Compute the balance of a given address by replaying the full chain.
 * This is an account-balance model built on top of all transactions.
 */
export function computeBalance(chain: Block[], address: string): number {
  let balance = 0;

  for (const block of chain) {
    for (const tx of block.transactions) {
      if (tx.to === address) balance += tx.amount;
      if (tx.from === address) balance -= tx.amount + tx.fee;
    }
  }

  return Math.round(balance * 1e8) / 1e8; // round to 8 decimal places
}

/**
 * Build a full address->balance map from the chain (used for the UTXO set cache).
 */
export function buildBalanceMap(chain: Block[]): Record<string, number> {
  const balances: Record<string, number> = {};

  for (const block of chain) {
    for (const tx of block.transactions) {
      balances[tx.to] = (balances[tx.to] ?? 0) + tx.amount;
      if (tx.from) {
        balances[tx.from] = (balances[tx.from] ?? 0) - tx.amount - tx.fee;
      }
    }
  }

  // Round all balances
  for (const addr of Object.keys(balances)) {
    balances[addr] = Math.round((balances[addr] ?? 0) * 1e8) / 1e8;
  }

  return balances;
}

/**
 * Determine the next mining difficulty.
 * Simple adaptive difficulty: adjusts every 10 blocks to target ~10s per block.
 */
export function nextDifficulty(chain: Block[]): number {
  const len = chain.length;
  if (len < 10) return MINING.INITIAL_DIFFICULTY;

  const last = chain[len - 1]!;
  const tenBack = chain[len - 10]!;
  const elapsed = last.timestamp - tenBack.timestamp; // ms
  const target = 10 * 10_000; // 10 blocks * 10s

  let difficulty = last.difficulty;
  if (elapsed < target / 2) difficulty++;       // Too fast — increase difficulty
  else if (elapsed > target * 2) difficulty--;  // Too slow — decrease difficulty

  return Math.max(1, difficulty);
}

/**
 * Compute the circulating supply (sum of all genesis allocations minus locked tokens).
 * For simplicity, circulating = total on-chain - founders locked portion.
 * The vesting module tracks the exact locked amount.
 */
export function computeTotalOnChain(chain: Block[]): number {
  let total = 0;
  for (const block of chain) {
    for (const tx of block.transactions) {
      if (tx.type === "genesis" || tx.type === "reward") {
        total += tx.amount;
      }
    }
  }
  return Math.round(total * 1e8) / 1e8;
}
