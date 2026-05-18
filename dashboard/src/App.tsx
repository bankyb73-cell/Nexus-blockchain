import { useState } from "react";
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, type Block, type Wallet } from "./lib/api";
import { cn, fmtNXC, shortHash, shortAddr, timeAgo } from "./lib/utils";
import {
  Blocks, Wallet as WalletIcon, BarChart3, Lock, Zap,
  Copy, Check, RefreshCw, ChevronDown, ChevronUp,
  ArrowRight, Shield, Coins, Globe, TrendingUp,
  AlertTriangle, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchInterval: 10_000, staleTime: 5_000 } },
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-muted-foreground hover:text-primary transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-5 flex flex-col gap-2 shadow-sm transition-all hover:shadow-md",
      accent && "border-glow glow-cyan"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon size={16} className={accent ? "text-primary" : "text-muted-foreground"} />
      </div>
      <div className={cn("text-2xl font-bold mono", accent ? "text-primary" : "text-foreground")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function BlockCard({ block, expanded, onToggle }: { block: Block; expanded: boolean; onToggle: () => void }) {
  const isGenesis = block.index === 0;
  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all",
      isGenesis && "border-primary/30"
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mono",
            isGenesis ? "bg-primary/20 text-primary" : "bg-muted text-foreground"
          )}>
            {block.index}
          </div>
          <div className="text-left">
            <div className="hash-text">{shortHash(block.hash, 12)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {block.transactions.length} tx · {timeAgo(block.timestamp)}
              {block.minedBy && <> · miner: {shortAddr(block.minedBy)}</>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            isGenesis ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {isGenesis ? "GENESIS" : `diff: ${block.difficulty}`}
          </span>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground mb-0.5">Hash</div>
              <div className="hash-text flex items-center gap-1">{shortHash(block.hash, 16)}<CopyButton text={block.hash} /></div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Prev Hash</div>
              <div className="hash-text">{shortHash(block.previousHash, 16)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Nonce</div>
              <div className="mono text-foreground">{block.nonce.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Time</div>
              <div className="mono text-foreground">{new Date(block.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transactions</div>
            {block.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                    tx.type === "genesis" ? "bg-yellow-500/20 text-yellow-400" :
                    tx.type === "reward" ? "bg-green-500/20 text-green-400" :
                    "bg-blue-500/20 text-blue-400"
                  )}>
                    {tx.type.toUpperCase()}
                  </span>
                  <div>
                    {tx.from ? <span className="text-muted-foreground">from {shortAddr(tx.from)} </span> : null}
                    <span className="text-muted-foreground">→ {shortAddr(tx.to)}</span>
                  </div>
                </div>
                <span className="font-bold text-primary mono">{fmtNXC(tx.amount)} NXC</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewTab() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const { data: allocData } = useQuery({ queryKey: ["allocations"], queryFn: api.allocations });
  const { data: vestingData } = useQuery({ queryKey: ["vesting"], queryFn: api.vesting });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading chain data…</div>;
  if (!stats) return null;

  const pct = (n: number) => ((n / stats.totalSupply) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
        stats.chainValid ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"
      )}>
        {stats.chainValid ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
        Chain is {stats.chainValid ? "valid" : "INVALID"} · {stats.name} ({stats.symbol}) · Height {stats.height}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Chain Height" value={stats.height.toString()} sub="blocks mined" icon={Blocks} accent />
        <StatCard label="Circulating" value={fmtNXC(stats.circulatingSupply)} sub={`${pct(stats.circulatingSupply)}% of total`} icon={Globe} />
        <StatCard label="Mining Difficulty" value={`${stats.difficulty}`} sub="leading zeros required" icon={Zap} />
        <StatCard label="Pending Txs" value={stats.pendingTransactions.toString()} sub="in mempool" icon={TrendingUp} />
      </div>

      {/* Supply breakdown */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Coins size={15} className="text-primary" /> Token Supply Breakdown
        </h3>
        <div className="space-y-3">
          {allocData && [
            { label: "Founder (locked)", addr: allocData.founder.address, alloc: allocData.founder.allocation, bal: allocData.founder.balance, color: "bg-yellow-500" },
            { label: "Ecosystem / Grants", addr: allocData.ecosystem.address, alloc: allocData.ecosystem.allocation, bal: allocData.ecosystem.balance, color: "bg-blue-500" },
            { label: "Validators / Staking", addr: allocData.validators.address, alloc: allocData.validators.allocation, bal: allocData.validators.balance, color: "bg-purple-500" },
            { label: "Public Sale", addr: allocData.publicSale.address, alloc: allocData.publicSale.allocation, bal: allocData.publicSale.balance, color: "bg-green-500" },
            { label: "Treasury", addr: allocData.treasury.address, alloc: allocData.treasury.allocation, bal: allocData.treasury.balance, color: "bg-orange-500" },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", item.color)} />
                  <span className="font-medium">{item.label}</span>
                  <span className="hash-text text-[10px]">{shortAddr(item.addr)}</span>
                  <CopyButton text={item.addr} />
                </div>
                <span className="mono text-foreground">{fmtNXC(item.bal)} / {fmtNXC(item.alloc)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", item.color)}
                  style={{ width: `${(item.alloc / stats.totalSupply) * 100}%`, opacity: 0.8 }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
          <span>Total Supply (hard cap)</span>
          <span className="mono font-bold text-foreground">{fmtNXC(stats.totalSupply)} NXC</span>
        </div>
      </div>

      {/* Vesting info */}
      {vestingData && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock size={15} className="text-primary" /> Founder Vesting Schedule
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <div className={cn("text-sm font-bold", vestingData.locked ? "text-yellow-400" : "text-green-400")}>
                {vestingData.locked ? "🔒 LOCKED" : "🔓 VESTING"}
              </div>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Months Vested</div>
              <div className="text-sm font-bold mono">{vestingData.monthsVested} / 24</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Total Vested</div>
              <div className="text-sm font-bold mono text-green-400">{fmtNXC(vestingData.totalVested)}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Remaining Locked</div>
              <div className="text-sm font-bold mono text-yellow-400">{fmtNXC(vestingData.remainingLocked)}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            <Lock size={11} />
            Lock unlocks: {new Date(vestingData.lockUnlockDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      )}
    </div>
  );
}

function ExplorerTab() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["chain"], queryFn: api.chain });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {data ? `${data.length} blocks` : "Loading…"}
        </h2>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {isLoading && <div className="text-muted-foreground text-sm text-center py-8">Loading blocks…</div>}
      <div className="space-y-2">
        {data?.chain.slice().reverse().map((block) => (
          <BlockCard
            key={block.index}
            block={block}
            expanded={expanded === block.index}
            onToggle={() => setExpanded(expanded === block.index ? null : block.index)}
          />
        ))}
      </div>
    </div>
  );
}

function MineTab() {
  const qc = useQueryClient();
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<{ block: Block; reward: number } | null>(null);

  const mine = useMutation({
    mutationFn: (addr: string) => api.mine(addr),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["chain"] });
    },
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <h2 className="font-semibold">Mine a Block</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Mining finds a nonce that produces a hash with the required leading zeros (Proof of Work). You earn 10 NXC + all pending transaction fees.
        </p>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Miner Wallet Address</label>
          <input
            className="w-full rounded-lg border bg-input px-3 py-2 text-sm mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <button
          onClick={() => mine.mutate(address)}
          disabled={!address || mine.isPending}
          className={cn(
            "w-full rounded-lg py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2",
            mine.isPending
              ? "bg-primary/20 text-primary cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          {mine.isPending ? (
            <><RefreshCw size={14} className="animate-spin" /> Mining…</>
          ) : (
            <><Zap size={14} /> Mine Block</>
          )}
        </button>
        {mine.isError && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} /> {mine.error.message}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle2 size={16} /> Block Mined!
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><div className="text-muted-foreground mb-0.5">Block</div><div className="mono font-bold text-foreground">#{result.block.index}</div></div>
            <div><div className="text-muted-foreground mb-0.5">Reward</div><div className="mono font-bold text-primary">{fmtNXC(result.reward)} NXC</div></div>
            <div><div className="text-muted-foreground mb-0.5">Nonce</div><div className="mono text-foreground">{result.block.nonce.toLocaleString()}</div></div>
            <div><div className="text-muted-foreground mb-0.5">Difficulty</div><div className="mono text-foreground">{result.block.difficulty}</div></div>
            <div className="col-span-2"><div className="text-muted-foreground mb-0.5">Hash</div><div className="hash-text break-all">{result.block.hash}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletTab() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balanceAddr, setBalanceAddr] = useState("");
  const [balance, setBalance] = useState<{ balance: number; symbol: string } | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try { setWallet(await api.newWallet()); }
    finally { setGenerating(false); }
  }

  async function checkBal() {
    if (!balanceAddr) return;
    setBalLoading(true);
    try { setBalance(await api.balance(balanceAddr)); }
    catch { setBalance(null); }
    finally { setBalLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Generate wallet */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <WalletIcon size={18} className="text-primary" />
          <h2 className="font-semibold">Generate Wallet</h2>
        </div>
        <p className="text-xs text-muted-foreground">Creates a new secp256k1 key pair. Save your private key — it cannot be recovered.</p>
        <button
          onClick={generate}
          disabled={generating}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <WalletIcon size={14} />}
          {generating ? "Generating…" : "New Wallet"}
        </button>

        {wallet && (
          <div className="space-y-2.5 pt-1">
            {[
              { label: "Address", value: wallet.address },
              { label: "Public Key", value: wallet.publicKey },
              { label: "Private Key", value: wallet.privateKey, sensitive: true },
            ].map(({ label, value, sensitive }) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  {label}
                  {sensitive && <span className="text-yellow-400 text-[10px] font-bold ml-1">⚠ SECRET</span>}
                </div>
                <div className={cn(
                  "rounded-lg px-3 py-2 text-xs mono break-all flex items-start justify-between gap-2",
                  sensitive ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted"
                )}>
                  <span className={sensitive ? "text-yellow-300" : "text-foreground"}>{value}</span>
                  <CopyButton text={value} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balance lookup */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h2 className="font-semibold">Check Balance</h2>
        </div>
        <input
          className="w-full rounded-lg border bg-input px-3 py-2 text-sm mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="0x address…"
          value={balanceAddr}
          onChange={(e) => setBalanceAddr(e.target.value)}
        />
        <button
          onClick={checkBal}
          disabled={!balanceAddr || balLoading}
          className="w-full rounded-lg bg-secondary text-secondary-foreground py-2.5 text-sm font-semibold hover:bg-accent transition-all disabled:opacity-50"
        >
          {balLoading ? "Looking up…" : "Check Balance"}
        </button>
        {balance !== null && (
          <div className="text-center py-3 rounded-lg bg-muted/40">
            <div className="text-xs text-muted-foreground mb-1">Balance</div>
            <div className="text-2xl font-bold mono text-primary">{fmtNXC(balance.balance)}</div>
            <div className="text-xs text-muted-foreground">{balance.symbol}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MempoolTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["pending"], queryFn: api.pending });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {data ? `${data.count} pending transaction${data.count !== 1 ? "s" : ""}` : "Loading…"}
        </h2>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {isLoading && <div className="text-muted-foreground text-sm text-center py-8">Loading…</div>}
      {data?.count === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Shield size={32} className="mx-auto mb-3 opacity-30" />
          Mempool is empty
        </div>
      )}
      <div className="space-y-2">
        {data?.transactions.map((tx) => (
          <div key={tx.id} className="rounded-xl border bg-card px-4 py-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="hash-text">{shortHash(tx.id, 10)}</span>
              <span className="mono font-bold text-primary">{fmtNXC(tx.amount)} NXC</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="mono">{shortAddr(tx.from ?? "GENESIS")}</span>
              <ArrowRight size={10} />
              <span className="mono">{shortAddr(tx.to)}</span>
              <span className="ml-auto text-[10px]">fee: {fmtNXC(tx.fee, 4)} NXC</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = "overview" | "explorer" | "mine" | "wallet" | "mempool";

function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "explorer", label: "Explorer", icon: Blocks },
    { id: "mine", label: "Mine", icon: Zap },
    { id: "wallet", label: "Wallet", icon: WalletIcon },
    { id: "mempool", label: "Mempool", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Coins size={15} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground leading-none">NEXUS</div>
              <div className="text-[10px] text-muted-foreground">NXC Blockchain</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {stats && (
              <>
                <span className="flex items-center gap-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full pulse-glow", stats.chainValid ? "bg-green-400" : "bg-red-400")} />
                  {stats.chainValid ? "Valid" : "Invalid"}
                </span>
                <span className="hidden sm:block">Height: <span className="text-foreground mono font-medium">{stats.height}</span></span>
                <span className="hidden sm:block">Diff: <span className="text-foreground mono font-medium">{stats.difficulty}</span></span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-border bg-card/30">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={13} />
              {label}
              {id === "mempool" && stats?.pendingTransactions ? (
                <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full ml-0.5">
                  {stats.pendingTransactions}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "explorer" && <ExplorerTab />}
        {tab === "mine" && <MineTab />}
        {tab === "wallet" && <WalletTab />}
        {tab === "mempool" && <MempoolTab />}
      </main>
    </div>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
