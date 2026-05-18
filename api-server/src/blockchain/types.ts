/** Core data types shared across blockchain modules */

export interface Transaction {
  id: string;
  from: string | null;  // null = coinbase/genesis transaction
  to: string;
  amount: number;
  fee: number;
  signature: string | null; // null = genesis transactions
  publicKey: string | null; // null = genesis transactions
  timestamp: number;
  type: "genesis" | "transfer" | "reward";
}

export interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  hash: string;
  nonce: number;
  difficulty: number;
  minedBy: string | null; // miner wallet address
}

export interface WalletData {
  address: string;
  publicKey: string;
  privateKey: string;
}

export interface AllocationWallets {
  founder: WalletData;
  ecosystem: WalletData;
  validators: WalletData;
  publicSale: WalletData;
  treasury: WalletData;
}

export interface VestingState {
  genesisTimestamp: number;
  founderAddress: string;
  totalAllocation: number;
  totalVested: number;
  totalClaimed: number;
  monthsVested: number;
  lastChecked: number;
}

export interface ChainState {
  chain: Block[];
  utxoSet: Record<string, number>; // address -> balance cache
  difficulty: number;
  pendingTransactions: Transaction[];
}
