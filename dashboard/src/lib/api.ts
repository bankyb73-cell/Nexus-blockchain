const BASE = "/api";

export interface ChainStats {
  name: string;
  symbol: string;
  height: number;
  totalSupply: number;
  totalOnChain: number;
  circulatingSupply: number;
  founderLockedSupply: number;
  pendingTransactions: number;
  difficulty: number;
  lastBlockHash: string | null;
  lastBlockTime: number | null;
  founderAddress: string | null;
  chainValid: boolean;
}

export interface Transaction {
  id: string;
  from: string | null;
  to: string;
  amount: number;
  fee: number;
  signature: string | null;
  publicKey: string | null;
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
  minedBy: string | null;
}

export interface Wallet {
  address: string;
  publicKey: string;
  privateKey: string;
  warning: string;
}

export interface Allocation {
  address: string;
  allocation: number;
  balance: number;
}

export interface Allocations {
  founder: Allocation;
  ecosystem: Allocation;
  validators: Allocation;
  publicSale: Allocation;
  treasury: Allocation;
  totalSupply: number;
  symbol: string;
}

export interface VestingInfo {
  founderAddress: string;
  locked: boolean;
  lockUnlockDate: string;
  monthsVested: number;
  totalVested: number;
  totalClaimed: number;
  availableToClaim: number;
  remainingLocked: number;
  vestingComplete: boolean;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  stats: () => request<ChainStats>("/stats"),
  chain: () => request<{ length: number; chain: Block[]; valid: boolean }>("/chain"),
  balance: (address: string) => request<{ address: string; balance: number; symbol: string }>(`/balance/${address}`),
  pending: () => request<{ count: number; transactions: Transaction[] }>("/pending"),
  allocations: () => request<Allocations>("/allocations"),
  vesting: () => request<VestingInfo>("/vesting"),

  newWallet: () => request<Wallet>("/wallet/new", { method: "POST" }),

  mine: (minerAddress: string) =>
    request<{ success: boolean; block: Block; reward: number; symbol: string }>("/mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minerAddress }),
    }),

  sendTransaction: (body: {
    from: string;
    to: string;
    amount: number;
    signature: string;
    publicKey: string;
    timestamp: number;
  }) =>
    request<{ success: boolean; transaction: Transaction }>("/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
