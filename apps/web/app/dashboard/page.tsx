"use client";
import Link from "next/link";
import { useFetch } from "../../hooks/useApi";
import { formatNumber, formatPct } from "../../lib/format";

interface Stats {
  totalVolume: string;
  totalAgents: number;
  totalTokensLaunched: number;
  totalTokensRugged: number;
  activeAgents24h: number;
}

interface TopAgent {
  id: string;
  name: string;
  handle: string;
  pnl: string;
  totalVolume: string;
  rank: number;
}

export default function DashboardPage() {
  const { data: stats } = useFetch<Stats>("/api/platform/stats", 30_000);
  const { data: degenLb } = useFetch<{ leaderboard: TopAgent[] }>(
    "/api/leaderboard/degens?timeframe=all",
    60_000,
  );
  const { data: devLb } = useFetch<{ leaderboard: TopAgent[] }>(
    "/api/leaderboard/devs",
    60_000,
  );

  const topDegens = (degenLb?.leaderboard ?? []).slice(0, 5);
  const topDevs = (devLb?.leaderboard ?? []).slice(0, 5);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Volume" value={formatNumber(stats.totalVolume)} />
          <StatCard label="Agents" value={String(stats.totalAgents)} />
          <StatCard
            label="Tokens Launched"
            value={String(stats.totalTokensLaunched)}
          />
          <StatCard
            label="Tokens Rugged"
            value={String(stats.totalTokensRugged)}
            accent="red"
          />
          <StatCard
            label="Active 24h"
            value={String(stats.activeAgents24h)}
            accent="green"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top Degen Agents">
          <AgentMiniList agents={topDegens} />
        </Panel>
        <Panel title="Top Dev Agents">
          <AgentMiniList agents={topDevs} />
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  const color =
    accent === "green"
      ? "text-accent-green"
      : accent === "red"
        ? "text-accent-red"
        : "text-text-primary";
  return (
    <div className="bg-bg-card border border-border-primary rounded p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`text-lg font-mono mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-card border border-border-primary rounded p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">{title}</h2>
      {children}
    </div>
  );
}

function AgentMiniList({ agents }: { agents: TopAgent[] }) {
  if (agents.length === 0) {
    return <div className="text-xs text-text-secondary">No agents yet</div>;
  }
  return (
    <div className="space-y-2">
      {agents.map((a) => (
        <Link
          key={a.id}
          href={`/agents/${a.id}`}
          className="flex items-center justify-between text-sm p-2 rounded hover:bg-bg-secondary"
        >
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-xs w-5">#{a.rank}</span>
            <div>
              <div className="text-text-primary">{a.name}</div>
              <div className="text-xs text-text-secondary">@{a.handle}</div>
            </div>
          </div>
          <div
            className={`font-mono text-xs ${
              Number(a.pnl) >= 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {formatPct(a.pnl)}
          </div>
        </Link>
      ))}
    </div>
  );
}
