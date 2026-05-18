# NEXUS Blockchain (NXC)

A complete proof-of-work blockchain system in Node.js/TypeScript with a native cryptocurrency, wallet system, UTXO-inspired account model, transaction mempool, vesting contract, and REST API.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies, proxied via `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Crypto: Node built-in `crypto` (SHA-256) + `elliptic` (secp256k1)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/blockchain/` — core blockchain modules
  - `constants.ts` — token name, supply, allocations, fee rate, vesting config
  - `types.ts` — shared TypeScript interfaces (Block, Transaction, WalletData, …)
  - `wallet.ts` — secp256k1 key generation, signing, verification
  - `transaction.ts` — transaction construction, validation, mempool
  - `genesis.ts` — genesis block creation, block hash computation
  - `blockchain.ts` — PoW mining, chain validation, balance computation, difficulty
  - `vesting.ts` — founder lock + monthly vesting contract
  - `persistence.ts` — JSON file I/O for chain/mempool/wallets/vesting
  - `state.ts` — in-memory singleton, init + mutation helpers
- `artifacts/api-server/src/routes/blockchain.ts` — all REST endpoints
- `artifacts/api-server/blockchain-data/` — persisted JSON state (auto-created)
  - `blockchain.json` — full chain
  - `mempool.json` — pending transactions
  - `founder_wallet.json` — founder private key (keep secure!)
  - `allocation_wallets.json` — all allocation wallet keypairs
  - `founderVesting.json` — vesting contract state

## Architecture decisions

- **Account-balance model** (not pure UTXO): balances replayed from full transaction history; simpler and matches the `{ from, to, amount }` REST API contract the spec requires.
- **Modular files**: each concern (wallet, transaction, genesis, blockchain, vesting, persistence, state) is its own module — no monolithic `index.js`.
- **In-memory singleton** (`state.ts`): all hot-path reads hit a balance cache rebuilt on every new block; disk writes are async-fire-and-continue.
- **Adaptive difficulty**: recalculates every 10 blocks targeting ~10 s per block.
- **Vesting enforced in code**: `vesting.ts` tracks lock end date (genesis + 365 days) and releases 1/24 of founder allocation per month thereafter.

## Product

NEXUS (NXC) is a self-contained blockchain node with a full REST API. Users can:
- View the full chain and chain stats
- Create wallets (secp256k1 key pairs)
- Sign and submit transactions (0.1% fee, miner-collected)
- Mine blocks (PoW, adjustable difficulty)
- Inspect token allocations and founder vesting schedule

## REST API

All routes are under `/api/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chain` | Full blockchain + validity flag |
| GET | `/api/balance/:address` | Wallet balance |
| GET | `/api/pending` | Mempool transactions |
| POST | `/api/transaction` | Submit `{ from, to, amount, signature, publicKey }` |
| POST | `/api/mine` | Mine next block `{ minerAddress }` |
| POST | `/api/wallet/new` | Generate new wallet |
| GET | `/api/stats` | Chain stats (height, supply, circulating, difficulty) |
| GET | `/api/vesting` | Founder vesting summary |
| GET | `/api/allocations` | All allocation addresses + balances |

## Token Allocations (40M NXC hard cap)

| Wallet | Amount | % |
|--------|--------|---|
| Founder | 8,000,000 | 20% — locked 12 months, vests 1/24/mo over 24 months |
| Ecosystem/Grants | 14,000,000 | 35% |
| Validators/Staking | 10,000,000 | 25% |
| Public Sale | 5,000,000 | 12.5% |
| Treasury | 3,000,000 | 7.5% |

## User preferences

- Token name: NEXUS / NXC — change in `src/blockchain/constants.ts`

## Gotchas

- `blockchain-data/` is created in `process.cwd()` — when run via workflow this is `artifacts/api-server/`.
- Mining is synchronous/single-threaded PoW — at difficulty 3 it is fast; difficulty 5+ will block the event loop for production use, move to a worker thread.
- Block reward is fixed at 10 NXC + collected fees; halving logic can be added in `blockchain.ts → mineBlock`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
