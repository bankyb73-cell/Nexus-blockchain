/**
 * REST API routes for the blockchain.
 *
 * GET  /api/chain              — full blockchain
 * GET  /api/balance/:address   — wallet balance
 * GET  /api/pending            — mempool
 * POST /api/transaction        — submit transaction { from, to, amount, signature, publicKey }
 * POST /api/mine               — mine next block { minerAddress }
 * POST /api/wallet/new         — generate a new wallet
 * GET  /api/stats              — chain stats
 * GET  /api/vesting            — founder vesting summary
 * GET  /api/allocations        — view all allocation addresses
 */

import { Router } from "express";
import { TOKEN } from "../blockchain/constants.js";
import { generateWallet } from "../blockchain/wallet.js";
import { finalizeTransaction } from "../blockchain/transaction.js";
import { mineBlock, isValidChain, computeTotalOnChain } from "../blockchain/blockchain.js";
import { vestingSummary } from "../blockchain/vesting.js";
import {
  getChain,
  getMempool,
  getDifficulty,
  getBalance,
  getFounderWallet,
  getAllocationWallets,
  getVestingState,
  appendBlock,
  submitTransaction,
} from "../blockchain/state.js";

const router = Router();

// ── GET /api/chain ─────────────────────────────────────────────────────────────
router.get("/chain", (_req, res) => {
  const chain = getChain();
  res.json({
    length: chain.length,
    chain,
    valid: isValidChain(chain),
  });
});

// ── GET /api/balance/:address ─────────────────────────────────────────────────
router.get("/balance/:address", (req, res) => {
  const { address } = req.params;
  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }
  const balance = getBalance(address);
  res.json({ address, balance, symbol: TOKEN.SYMBOL });
});

// ── GET /api/pending ──────────────────────────────────────────────────────────
router.get("/pending", (_req, res) => {
  const pending = getMempool();
  res.json({ count: pending.length, transactions: pending });
});

// ── POST /api/transaction ─────────────────────────────────────────────────────
router.post("/transaction", async (req, res) => {
  const { from, to, amount, signature, publicKey, timestamp } = req.body as {
    from?: string;
    to?: string;
    amount?: number;
    signature?: string;
    publicKey?: string;
    timestamp?: number;
  };

  if (!from || !to || amount == null || !signature || !publicKey) {
    res.status(400).json({
      error: "Required fields: from, to, amount, signature, publicKey",
    });
    return;
  }

  if (typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" });
    return;
  }

  const fee = Math.ceil(amount * TOKEN.TRANSACTION_FEE_RATE * 1e8) / 1e8;
  const ts = timestamp ?? Date.now();

  const tx = finalizeTransaction(
    { from, to, amount, fee, timestamp: ts, type: "transfer" },
    signature,
    publicKey
  );

  const error = await submitTransaction(tx);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  req.log.info({ txId: tx.id }, "Transaction submitted to mempool");
  res.status(201).json({ success: true, transaction: tx });
});

// ── POST /api/mine ────────────────────────────────────────────────────────────
router.post("/mine", async (req, res) => {
  const { minerAddress } = req.body as { minerAddress?: string };

  if (!minerAddress) {
    res.status(400).json({ error: "minerAddress is required" });
    return;
  }

  const chain = getChain();
  const previousBlock = chain[chain.length - 1]!;
  const difficulty = getDifficulty();
  const pendingTxs = getMempool();

  req.log.info({ difficulty, pendingCount: pendingTxs.length }, "Mining started");

  const newBlock = mineBlock(previousBlock, pendingTxs, minerAddress, difficulty);

  await appendBlock(newBlock);

  req.log.info(
    { blockIndex: newBlock.index, hash: newBlock.hash, nonce: newBlock.nonce },
    "Block mined successfully"
  );

  res.status(201).json({
    success: true,
    block: newBlock,
    reward: newBlock.transactions[0]?.amount ?? 0,
    symbol: TOKEN.SYMBOL,
  });
});

// ── POST /api/wallet/new ──────────────────────────────────────────────────────
router.post("/wallet/new", (_req, res) => {
  const wallet = generateWallet();
  // Note: private key is returned here — in production, this should only be
  // returned once and never stored server-side.
  res.status(201).json({
    address: wallet.address,
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    warning: "Save your private key! It cannot be recovered if lost.",
  });
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
router.get("/stats", (_req, res) => {
  const chain = getChain();
  const mempool = getMempool();
  const vesting = getVestingState();
  const fw = getFounderWallet();

  const totalOnChain = computeTotalOnChain(chain);
  const founderLocked = vesting
    ? vesting.totalAllocation - vesting.totalVested
    : TOKEN.ALLOCATIONS.FOUNDER;

  const circulating = totalOnChain - founderLocked;

  res.json({
    name: TOKEN.NAME,
    symbol: TOKEN.SYMBOL,
    height: chain.length,
    totalSupply: TOKEN.TOTAL_SUPPLY,
    totalOnChain,
    circulatingSupply: Math.max(0, circulating),
    founderLockedSupply: founderLocked,
    pendingTransactions: mempool.length,
    difficulty: getDifficulty(),
    lastBlockHash: chain[chain.length - 1]?.hash ?? null,
    lastBlockTime: chain[chain.length - 1]?.timestamp ?? null,
    founderAddress: fw?.address ?? null,
    chainValid: isValidChain(chain),
  });
});

// ── GET /api/vesting ──────────────────────────────────────────────────────────
router.get("/vesting", (_req, res) => {
  const vesting = getVestingState();
  if (!vesting) {
    res.status(503).json({ error: "Blockchain not initialized" });
    return;
  }
  const summary = vestingSummary(vesting, Date.now());
  res.json({ founderAddress: vesting.founderAddress, ...summary });
});

// ── GET /api/allocations ──────────────────────────────────────────────────────
router.get("/allocations", (_req, res) => {
  const aw = getAllocationWallets();
  if (!aw) {
    res.status(503).json({ error: "Blockchain not initialized" });
    return;
  }
  res.json({
    founder:    { address: aw.founder.address,    allocation: TOKEN.ALLOCATIONS.FOUNDER,    balance: getBalance(aw.founder.address) },
    ecosystem:  { address: aw.ecosystem.address,  allocation: TOKEN.ALLOCATIONS.ECOSYSTEM,  balance: getBalance(aw.ecosystem.address) },
    validators: { address: aw.validators.address, allocation: TOKEN.ALLOCATIONS.VALIDATORS, balance: getBalance(aw.validators.address) },
    publicSale: { address: aw.publicSale.address, allocation: TOKEN.ALLOCATIONS.PUBLIC_SALE, balance: getBalance(aw.publicSale.address) },
    treasury:   { address: aw.treasury.address,   allocation: TOKEN.ALLOCATIONS.TREASURY,   balance: getBalance(aw.treasury.address) },
    totalSupply: TOKEN.TOTAL_SUPPLY,
    symbol: TOKEN.SYMBOL,
  });
});

export default router;
