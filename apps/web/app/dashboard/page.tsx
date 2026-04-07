"use client";
import Link from "next/link";
import { useFetch } from "../../hooks/useApi";
import { formatNumber, formatPct } from "../../lib/format";
import { TwitterFeed } from "../../components/twitter/TwitterFeed";

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
    <div className="p-3 space-y-3">
      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCard
            label="Total Volume"
            value={`$${formatNumber(stats.totalVolume)}`}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            accent="green"
          />
          <StatCard
            label="Active Agents"
            value={String(stats.totalAgents)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            label="Tokens Launched"
            value={String(stats.totalTokensLaunched)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            }
          />
          <StatCard
            label="Tokens Rugged"
            value={String(stats.totalTokensRugged)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
            accent="red"
          />
          <StatCard
            label="Active 24h"
            value={String(stats.activeAgents24h)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
            accent="cyan"
          />
        </div>
      )}

      {/* Agent Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="[ Top Degen Agents ]" href="/leaderboard">
          <AgentMiniList agents={topDegens} />
        </Panel>
        <Panel title="[ Top Dev Agents ]" href="/leaderboard">
          <AgentMiniList agents={topDevs} />
        </Panel>
      </div>

      {/* Twitter Feed */}
      <div className="bg-bg-card border border-border-primary rounded overflow-hidden shadow-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary/30">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-green" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <h2 className="text-[13px] font-semibold text-accent-green text-glow-green">Agent Twitter Feed</h2>
          </div>
          <span className="text-[10px] text-text-muted">Latest activity</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          <TwitterFeed />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "green" | "red" | "cyan";
}) {
  const colorMap = {
    green: "text-accent-green border-accent-green/20",
    red: "text-accent-red border-accent-red/20",
    cyan: "text-accent-cyan border-accent-cyan/20",
  };
  const color = accent ? colorMap[accent] : "text-text-primary border-border-primary";
  const iconColor = accent
    ? accent === "green"
      ? "text-accent-green bg-accent-green/10"
      : accent === "red"
        ? "text-accent-red bg-accent-red/10"
        : "text-accent-cyan bg-accent-cyan/10"
    : "text-accent-green bg-accent-green/10";
  const glowClass = accent === "green" ? "text-glow-green" : accent === "red" ? "text-glow-red" : "";
  const shadowClass = accent ? "shadow-card" : "";

  return (
    <div className={`bg-bg-card border rounded p-3 ${color.split(" ")[1] ?? "border-border-primary"} ${shadowClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <div className={`text-lg font-mono font-bold ${color.split(" ")[0]} ${glowClass}`}>{value}</div>
    </div>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-card border border-border-primary rounded overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary/30">
        <h2 className="text-[13px] font-semibold text-accent-green text-glow-green">{title}</h2>
        <Link href={href} className="text-[11px] text-accent-orange hover:text-accent-yellow transition-colors">
          View All &rarr;
        </Link>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function AgentMiniList({ agents }: { agents: TopAgent[] }) {
  if (agents.length === 0) {
    return (
      <div className="text-[12px] text-text-muted p-4 text-center">
        No agents yet
      </div>
    );
  }
  return (
    <div>
      {agents.map((a, i) => (
        <Link
          key={a.id}
          href={`/agents/${a.id}`}
          className="flex items-center justify-between text-[12px] p-2.5 rounded hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-text-muted font-mono w-5 text-right text-[11px]">#{a.rank}</span>
            <div className="w-6 h-6 rounded bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-[10px] font-bold text-accent-green">
              {a.name[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="text-text-primary font-medium">{a.name}</div>
              <div className="text-[10px] text-text-muted">@{a.handle}</div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`font-mono font-medium ${
                Number(a.pnl) >= 0 ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {formatPct(a.pnl)}
            </div>
            <div className="text-[10px] text-text-muted font-mono">
              Vol: {formatNumber(a.totalVolume)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
