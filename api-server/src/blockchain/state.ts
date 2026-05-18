/**
 * In-memory singleton that holds the live blockchain state.
 * Initialized once on startup by initBlockchain(), then mutated by mine/transaction calls.
 */

import { logger } from "../lib/logger.js";
import { TOKEN } from "./constants.js";
import { generateAllocationWallets, createGenesisBlock } from "./genesis.js";
import { buildBalanceMap, computeBalance, nextDifficulty } from "./blockchain.js";
import { validateTransaction } from "./transaction.js";
import { createVestingState, advanceVesting } from "./vesting.js";
import {
  loadChain, saveChain,
  loadMempool, saveMempool,
  loadFounderWallet, saveFounderWallet,
  loadAllocationWallets, saveAllocationWallets,
  loadVestingState, saveVestingState,
} from "./persistence.js";
import type { Block, Transaction, AllocationWallets, WalletData, VestingState } from "./types.js";

// ── Live state ────────────────────────────────────────────────────────────────

let chain: Block[] = [];
let mempool: Transaction[] = [];
let balanceCache: Record<string, number> = {};
let difficulty: number = 3;
let founderWallet: WalletData | null = null;
let allocationWallets: AllocationWallets | null = null;
let vestingState: VestingState | null = null;

// ── Getters ───────────────────────────────────────────────────────────────────

export function getChain(): Block[] { return chain; }
export function getMempool(): Transaction[] { return mempool; }
export function getDifficulty(): number { return difficulty; }
export function getFounderWallet(): WalletData | null { return founderWallet; }
export function getAllocationWallets(): AllocationWallets | null { return allocationWallets; }
export function getVestingState(): VestingState | null { return vestingState; }

export function getBalance(address: string): number {
  return balanceCache[address] ?? 0;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Add a validated block to the chain, clear claimed pending txs, update cache. */
export async function appendBlock(block: Block): Promise<void> {
  chain.push(block);
  // Remove mined transactions from mempool
  const minedIds = new Set(block.transactions.map((t) => t.id));
  mempool = mempool.filter((t) => !minedIds.has(t.id));
  // Rebuild balance cache and difficulty
  balanceCache = buildBalanceMap(chain);
  difficulty = nextDifficulty(chain);
  // Advance vesting
  if (vestingState) {
    const { updated } = advanceVesting(vestingState, Date.now());
    vestingState = updated;
    await saveVestingState(vestingState);
  }
  await saveChain(chain);
  await saveMempool(mempool);
}

/** Add a transaction to the mempool after validation. Returns error string or null. */
export async function submitTransaction(tx: Transaction): Promise<string | null> {
  // Check for duplicate
  if (mempool.some((t) => t.id === tx.id)) {
    return "Transaction already in mempool";
  }

  const error = validateTransaction(tx, getBalance);
  if (error) return error;

  mempool.push(tx);
  await saveMempool(mempool);
  return null;
}

/** Update vesting state and persist. */
export async function updateVestingState(updated: VestingState): Promise<void> {
  vestingState = updated;
  await saveVestingState(updated);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Initialize the blockchain on server startup.
 * Loads persisted data if it exists; otherwise creates a fresh genesis chain.
 */
export async function initBlockchain(): Promise<void> {
  // Try to load existing chain
  const existingChain = await loadChain();
  const existingMempool = await loadMempool();
  const existingFounder = await loadFounderWallet();
  const existingAllocations = await loadAllocationWallets();
  const existingVesting = await loadVestingState();

  if (
    existingChain &&
    existingChain.length > 0 &&
    existingFounder &&
    existingAllocations &&
    existingVesting
  ) {
    // Restore from disk
    chain = existingChain;
    mempool = existingMempool ?? [];
    founderWallet = existingFounder;
    allocationWallets = existingAllocations;
    vestingState = existingVesting;
    balanceCache = buildBalanceMap(chain);
    difficulty = nextDifficulty(chain);

    logger.info({ height: chain.length }, "Blockchain restored from disk");
  } else {
    // Fresh start — generate wallets and genesis block
    logger.info("No existing chain found — creating genesis block");

    const wallets = generateAllocationWallets();
    const genesis = createGenesisBlock(wallets);

    chain = [genesis];
    mempool = [];
    founderWallet = wallets.founder;
    allocationWallets = wallets;
    vestingState = createVestingState(wallets.founder.address, genesis.timestamp);
    balanceCache = buildBalanceMap(chain);
    difficulty = 3;

    // Persist everything
    await saveChain(chain);
    await saveMempool(mempool);
    await saveFounderWallet(wallets.founder);
    await saveAllocationWallets(wallets);
    await saveVestingState(vestingState);

    logger.info({ genesisHash: genesis.hash }, "Genesis block created");
  }

  // Print startup summary
  const fw = founderWallet!;
  const aw = allocationWallets!;
  const founderBalance = computeBalance(chain, fw.address);

  logger.info("═══════════════════════════════════════════════");
  logger.info(`  ${TOKEN.NAME} (${TOKEN.SYMBOL}) Blockchain`);
  logger.info("═══════════════════════════════════════════════");
  logger.info(`  Founder address  : ${fw.address}`);
  logger.info(`  Founder balance  : ${founderBalance.toLocaleString()} ${TOKEN.SYMBOL}`);
  logger.info("───────────────────────────────────────────────");
  logger.info("  Token Allocations:");
  logger.info(`    Founder         : ${TOKEN.ALLOCATIONS.FOUNDER.toLocaleString()} NXC → ${fw.address}`);
  logger.info(`    Ecosystem/Grants: ${TOKEN.ALLOCATIONS.ECOSYSTEM.toLocaleString()} NXC → ${aw.ecosystem.address}`);
  logger.info(`    Validators      : ${TOKEN.ALLOCATIONS.VALIDATORS.toLocaleString()} NXC → ${aw.validators.address}`);
  logger.info(`    Public Sale     : ${TOKEN.ALLOCATIONS.PUBLIC_SALE.toLocaleString()} NXC → ${aw.publicSale.address}`);
  logger.info(`    Treasury        : ${TOKEN.ALLOCATIONS.TREASURY.toLocaleString()} NXC → ${aw.treasury.address}`);
  logger.info(`    Total Supply    : ${TOKEN.TOTAL_SUPPLY.toLocaleString()} NXC (hard cap)`);
  logger.info("═══════════════════════════════════════════════");
}
