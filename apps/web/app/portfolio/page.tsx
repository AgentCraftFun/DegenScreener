"use client";
import Link from "next/link";
import { useFetch } from "../../hooks/useApi";
import { useAuthStore } from "../../stores/auth-store";
import { formatNumber } from "../../lib/format";

interface Agent {
  id: string;
  name: string;
  handle: string;
  type: string;
  status: string;
  balance: string;
  totalPnl: string;
  totalVolume: string;
  ethBalance: string;
  walletAddress?: string;
  totalFeesEarned: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  fee: string;
  netAmount: string;
  status: string;
  createdAt: string;
  txHash: string;
}

export default function PortfolioPage() {
  const { isConnected } = useAuthStore();
  const { data: user } = useFetch<{
    user: { internalBalance: string; totalDeposited: string; totalWithdrawn: string };
    agentCount: number;
  }>(isConnected ? "/api/user/profile" : null, 10_000);
  const { data: agents } = useFetch<{ agents: Agent[] }>(
    isConnected ? "/api/user/agents" : null,
    10_000,
  );
  const { data: txs } = useFetch<{ transactions: Transaction[] }>(
    isConnected ? "/api/user/transactions?limit=20" : null,
  );

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="bg-bg-card border border-border-primary rounded p-8 text-center max-w-sm shadow-card">
          <div className="w-12 h-12 rounded bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
            </svg>
          </div>
          <p className="text-text-secondary text-[13px]">
            Connect your wallet to view your portfolio.
          </p>
        </div>
      </div>
    );
  }

  const totalEth = (agents?.agents ?? []).reduce(
    (sum, a) => sum + Number(a.ethBalance || 0),
    0,
  );
  const totalPnl = (agents?.agents ?? []).reduce(
    (sum, a) => sum + Number(a.totalPnl || 0),
    0,
  );

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-lg font-bold text-accent-green text-glow-green">[ Portfolio ]</h1>

      {/* Stats */}
      {user && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard label="Total ETH" value={`${totalEth.toFixed(4)} ETH`} accent="green" />
          <StatCard label="Total P&L" value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(4)} ETH`} accent={totalPnl >= 0 ? "green" : "orange"} />
          <StatCard label="Agents" value={String(agents?.agents.length ?? 0)} accent="cyan" />
          <StatCard label="Internal Balance" value={formatNumber(user.user.internalBalance)} accent="orange" />
        </div>
      )}

      {/* My Agents */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-accent-green">My Agents</h2>
          <Link href="/deploy" className="text-[11px] text-accent-orange hover:text-accent-yellow transition-colors">
            + Deploy New
          </Link>
        </div>
        {(agents?.agents ?? []).length === 0 ? (
          <div className="bg-bg-card border border-border-primary rounded p-8 text-center shadow-card">
            <p className="text-text-muted text-[12px] mb-3">No agents deployed yet</p>
            <Link
              href="/deploy"
              className="inline-block px-4 py-2 bg-accent-green/15 border border-accent-green/30 text-accent-green rounded text-[12px] font-semibold hover:bg-accent-green/25 transition-colors"
            >
              Deploy First Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {agents?.agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="bg-bg-card border border-border-primary rounded p-3.5 hover:border-accent-green/30 hover:bg-bg-hover/30 transition-all group shadow-card"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold border ${
                      a.type === "DEV"
                        ? "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20"
                        : "bg-accent-purple/10 text-accent-purple border-accent-purple/20"
                    }`}>
                      {a.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] group-hover:text-accent-green transition-colors">{a.name}</div>
                      <div className="text-[10px] text-text-muted">@{a.handle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === "ACTIVE" ? "bg-accent-green shadow-[0_0_4px_rgba(0,255,65,0.5)]" : "bg-accent-red shadow-[0_0_4px_rgba(255,59,59,0.5)]"}`} />
                    <span className={`text-[10px] font-medium ${a.status === "ACTIVE" ? "text-accent-green" : "text-accent-red"}`}>
                      {a.status}
                    </span>
                  </div>
                </div>
                {a.walletAddress && (
                  <div className="text-[10px] font-mono text-text-muted mb-2 truncate">
                    {a.walletAddress.slice(0, 6)}...{a.walletAddress.slice(-4)}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <div className="text-text-muted">ETH Balance</div>
                    <div className="font-mono text-accent-cyan font-medium">
                      {Number(a.ethBalance || 0).toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted">P&L</div>
                    <div
                      className={`font-mono font-medium ${
                        Number(a.totalPnl) >= 0 ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {Number(a.totalPnl) >= 0 ? "+" : ""}
                      {formatNumber(a.totalPnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted">{a.type === "DEV" ? "Fees" : "Volume"}</div>
                    <div className="font-mono text-text-secondary">
                      {a.type === "DEV" ? formatNumber(a.totalFeesEarned) : formatNumber(a.totalVolume)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Transaction History */}
      <section>
        <h2 className="text-[13px] font-semibold text-accent-green mb-2">Transaction History</h2>
        <div className="bg-bg-card border border-border-primary rounded overflow-hidden shadow-card">
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-accent-green/60 border-b border-border-primary bg-bg-secondary/30">
              <tr>
                <th className="text-left px-3 py-2.5">Type</th>
                <th className="text-right px-3 py-2.5">Amount</th>
                <th className="text-right px-3 py-2.5">Fee</th>
                <th className="text-right px-3 py-2.5">Net</th>
                <th className="text-center px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {(txs?.transactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-muted">
                    No transactions
                  </td>
                </tr>
              ) : (
                (txs?.transactions ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30 transition-colors">
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        t.type === "DEPOSIT" ? "text-accent-green" : "text-accent-red"
                      }`}>
                        <span className="text-[10px]">{t.type === "DEPOSIT" ? ">" : "<"}</span>
                        {t.type === "DEPOSIT" ? "Deposit" : "Withdraw"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">
                      {formatNumber(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">
                      {formatNumber(t.fee)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-primary">
                      {formatNumber(t.netAmount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                          t.status === "CONFIRMED"
                            ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                            : t.status === "PENDING"
                              ? "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20"
                              : "bg-accent-red/10 text-accent-red border-accent-red/20"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const colorMap: Record<string, string> = {
    green: "text-accent-green",
    cyan: "text-accent-cyan",
    orange: "text-accent-orange",
  };
  const glowMap: Record<string, string> = {
    green: "text-glow-green",
  };
  return (
    <div className="bg-bg-card border border-border-primary rounded p-3 shadow-card">
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-mono font-bold mt-1 ${colorMap[accent ?? ""] ?? "text-text-primary"} ${glowMap[accent ?? ""] ?? ""}`}>{value}</div>
    </div>
  );
}
