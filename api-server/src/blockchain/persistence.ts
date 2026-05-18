/**
 * Persistence module — load and save blockchain state to JSON files.
 *
 * All data files live in  <workspace-root>/blockchain-data/
 * Files:
 *   blockchain.json      — full chain
 *   mempool.json         — pending transactions
 *   founder_wallet.json  — founder private key (keep secure!)
 *   allocation_wallets.json — ecosystem, validators, publicSale, treasury
 *   founderVesting.json  — vesting contract state
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Block, Transaction, AllocationWallets, WalletData, VestingState } from "./types.js";

const DATA_DIR = path.resolve(process.cwd(), "blockchain-data");

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

async function readJson<T>(filename: string): Promise<T | null> {
  const fp = dataPath(filename);
  if (!existsSync(fp)) return null;
  const raw = await readFile(fp, "utf-8");
  return JSON.parse(raw) as T;
}

async function writeJson<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  await writeFile(dataPath(filename), JSON.stringify(data, null, 2), "utf-8");
}

// ── Blockchain ────────────────────────────────────────────────────────────────

export async function loadChain(): Promise<Block[] | null> {
  return readJson<Block[]>("blockchain.json");
}

export async function saveChain(chain: Block[]): Promise<void> {
  await writeJson("blockchain.json", chain);
}

// ── Mempool ───────────────────────────────────────────────────────────────────

export async function loadMempool(): Promise<Transaction[] | null> {
  return readJson<Transaction[]>("mempool.json");
}

export async function saveMempool(txs: Transaction[]): Promise<void> {
  await writeJson("mempool.json", txs);
}

// ── Wallets ───────────────────────────────────────────────────────────────────

export async function loadFounderWallet(): Promise<WalletData | null> {
  return readJson<WalletData>("founder_wallet.json");
}

export async function saveFounderWallet(wallet: WalletData): Promise<void> {
  await writeJson("founder_wallet.json", wallet);
}

export async function loadAllocationWallets(): Promise<AllocationWallets | null> {
  return readJson<AllocationWallets>("allocation_wallets.json");
}

export async function saveAllocationWallets(wallets: AllocationWallets): Promise<void> {
  await writeJson("allocation_wallets.json", wallets);
}

// ── Vesting ───────────────────────────────────────────────────────────────────

export async function loadVestingState(): Promise<VestingState | null> {
  return readJson<VestingState>("founderVesting.json");
}

export async function saveVestingState(state: VestingState): Promise<void> {
  await writeJson("founderVesting.json", state);
}
