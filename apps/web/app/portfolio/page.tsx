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
      <div className="p-4">
        <div className="bg-bg-card border border-border-primary rounded p-8 text-center">
          <p className="text-text-secondary">
            Connect your wallet to view your portfolio.
          </p>
        </div>
      </div>
    );
  }

  const totalAgentBalance = (agents?.agents ?? []).reduce(
    (sum, a) => sum + Number(a.balance),
    0,
  );

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Portfolio</h1>
      {user && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Internal Balance" value={formatNumber(user.user.internalBalance)} />
          <StatCard label="Agent Balances" value={formatNumber(totalAgentBalance)} />
          <StatCard label="Deposited" value={formatNumber(user.user.totalDeposited)} />
          <StatCard label="Withdrawn" value={formatNumber(user.user.totalWithdrawn)} />
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">My Agents</h2>
        {(agents?.agents ?? []).length === 0 ? (
          <div className="bg-bg-card border border-border-primary rounded p-6 text-center">
            <p className="text-text-secondary mb-3">No agents yet</p>
            <Link
              href="/deploy"
              className="inline-block px-4 py-2 bg-accent-blue text-white rounded text-sm"
            >
              Deploy First Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents?.agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="bg-bg-card border border-border-primary rounded p-4 hover:border-accent-blue"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-text-secondary">@{a.handle}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      a.status === "ACTIVE"
                        ? "bg-accent-green/20 text-accent-green"
                        : "bg-accent-red/20 text-accent-red"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-text-secondary">Balance</div>
                    <div className="font-mono text-accent-blue">
                      {formatNumber(a.balance)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-secondary">P&L</div>
                    <div
                      className={`font-mono ${
                        Number(a.totalPnl) >= 0
                          ? "text-accent-green"
                          : "text-accent-red"
                      }`}
                    >
                      {Number(a.totalPnl) >= 0 ? "+" : ""}
                      {formatNumber(a.totalPnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-secondary">Volume</div>
                    <div className="font-mono text-text-secondary">
                      {formatNumber(a.totalVolume)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Transaction History</h2>
        <div className="bg-bg-card border border-border-primary rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-text-secondary border-b border-border-primary">
              <tr>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-right px-3 py-2">Fee</th>
                <th className="text-right px-3 py-2">Net</th>
                <th className="text-center px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(txs?.transactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-text-secondary">
                    No transactions
                  </td>
                </tr>
              ) : (
                (txs?.transactions ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border-primary">
                    <td
                      className={`px-3 py-2 text-xs font-semibold ${
                        t.type === "DEPOSIT" ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {t.type === "DEPOSIT" ? "↓ DEP" : "↑ WD"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatNumber(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-text-secondary">
                      {formatNumber(t.fee)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatNumber(t.netAmount)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          t.status === "CONFIRMED"
                            ? "bg-accent-green/20 text-accent-green"
                            : t.status === "PENDING"
                              ? "bg-accent-yellow/20 text-accent-yellow"
                              : "bg-accent-red/20 text-accent-red"
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card border border-border-primary rounded p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-lg font-mono mt-1">{value}</div>
    </div>
  );
}
