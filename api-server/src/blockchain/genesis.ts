/**
 * Genesis module — creates the very first block and establishes token allocations.
 * All allocations are enforced here and cannot be changed.
 */

import { createHash } from "node:crypto";
import { TOKEN, MINING } from "./constants.js";
import { generateWallet } from "./wallet.js";
import { createGenesisTransaction } from "./transaction.js";
import type { Block, AllocationWallets } from "./types.js";

/**
 * Generate fresh allocation wallets (founder + ecosystem + validators + publicSale + treasury).
 * Called only on first run; results saved to disk.
 */
export function generateAllocationWallets(): AllocationWallets {
  return {
    founder: generateWallet(),
    ecosystem: generateWallet(),
    validators: generateWallet(),
    publicSale: generateWallet(),
    treasury: generateWallet(),
  };
}

/**
 * Compute a block hash from its fields.
 */
export function computeBlockHash(block: Omit<Block, "hash">): string {
  const data = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    transactions: block.transactions,
    previousHash: block.previousHash,
    nonce: block.nonce,
    difficulty: block.difficulty,
    minedBy: block.minedBy,
  });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Create the genesis block with all token allocations baked in.
 * The allocations are signed off as coinbase/genesis transactions — no inputs, protocol-issued.
 */
export function createGenesisBlock(wallets: AllocationWallets): Block {
  const timestamp = Date.now();

  // All five allocation transactions in genesis
  const transactions = [
    createGenesisTransaction(wallets.founder.address,    TOKEN.ALLOCATIONS.FOUNDER,    timestamp),
    createGenesisTransaction(wallets.ecosystem.address,  TOKEN.ALLOCATIONS.ECOSYSTEM,  timestamp),
    createGenesisTransaction(wallets.validators.address, TOKEN.ALLOCATIONS.VALIDATORS, timestamp),
    createGenesisTransaction(wallets.publicSale.address, TOKEN.ALLOCATIONS.PUBLIC_SALE, timestamp),
    createGenesisTransaction(wallets.treasury.address,   TOKEN.ALLOCATIONS.TREASURY,   timestamp),
  ];

  const partial: Omit<Block, "hash"> = {
    index: 0,
    timestamp,
    transactions,
    previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
    nonce: 0,
    difficulty: MINING.INITIAL_DIFFICULTY,
    minedBy: null,
  };

  const hash = computeBlockHash(partial);
  return { ...partial, hash };
}
