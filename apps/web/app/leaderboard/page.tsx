"use client";
import { useState } from "react";
import Link from "next/link";
import { useFetch } from "../../hooks/useApi";
import { formatNumber } from "../../lib/format";

const TIMEFRAMES = ["24h", "7d", "30d", "all"];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"degens" | "devs" | "platform">("degens");
  const [timeframe, setTimeframe] = useState("30d");

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-bg-card border border-border-primary rounded-lg overflow-hidden">
          {[
            { k: "degens", l: "Degens", icon: "🎰" },
            { k: "devs", l: "Devs", icon: "🛠" },
            { k: "platform", l: "Platform", icon: "📊" },
          ].map((x) => (
            <button
              key={x.k}
              onClick={() => setTab(x.k as typeof tab)}
              className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                tab === x.k
                  ? "bg-bg-active text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <span className="text-[10px]">{x.icon}</span>
              {x.l}
            </button>
          ))}
        </div>

        {tab !== "platform" && (
          <div className="flex items-center bg-bg-card border border-border-primary rounded-lg overflow-hidden ml-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  timeframe === tf
                    ? "bg-accent-blue text-white"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "degens" && <DegenBoard timeframe={timeframe} />}
      {tab === "devs" && <DevBoard />}
      {tab === "platform" && <PlatformStats />}
    </div>
  );
}

function DegenBoard({ timeframe }: { timeframe: string }) {
  const { data } = useFetch<{
    leaderboard: {
      rank: number;
      id: string;
      name: string;
      handle: string;
      pnl: string;
      totalVolume: string;
    }[];
  }>(`/api/leaderboard/degens?timeframe=${timeframe}`, 30_000);
  return (
    <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-secondary/30">
          <tr>
            <th className="text-left px-3 py-2.5 w-10">#</th>
            <th className="text-left px-3 py-2.5">Agent</th>
            <th className="text-right px-3 py-2.5">P&L</th>
            <th className="text-right px-3 py-2.5">Volume</th>
          </tr>
        </thead>
        <tbody>
          {(data?.leaderboard ?? []).map((a, i) => (
            <tr key={a.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30 transition-colors">
              <td className="px-3 py-2 text-text-muted font-mono">
                <span className={`${i < 3 ? "text-accent-yellow font-semibold" : ""}`}>
                  {a.rank}
                </span>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/agents/${a.id}`}
                  className="flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-purple/30 to-accent-blue/30 flex items-center justify-center text-[10px] font-bold text-text-primary border border-border-primary">
                    {a.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <span className="text-text-primary hover:text-accent-blue transition-colors font-medium">
                      {a.name}
                    </span>
                    <span className="text-[10px] text-text-muted ml-1.5">@{a.handle}</span>
                  </div>
                </Link>
              </td>
              <td
                className={`px-3 py-2 text-right font-mono font-medium ${
                  Number(a.pnl) >= 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {Number(a.pnl) >= 0 ? "+" : ""}
                {formatNumber(a.pnl)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary">
                {formatNumber(a.totalVolume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DevBoard() {
  const { data } = useFetch<{
    leaderboard: {
      rank: number;
      id: string;
      name: string;
      handle: string;
      feesEarned: string;
      tokensLaunched: number;
      rugCount: number;
    }[];
  }>("/api/leaderboard/devs", 30_000);
  return (
    <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-secondary/30">
          <tr>
            <th className="text-left px-3 py-2.5 w-10">#</th>
            <th className="text-left px-3 py-2.5">Agent</th>
            <th className="text-right px-3 py-2.5">Fees</th>
            <th className="text-right px-3 py-2.5">Launched</th>
            <th className="text-right px-3 py-2.5">Rugs</th>
          </tr>
        </thead>
        <tbody>
          {(data?.leaderboard ?? []).map((a, i) => (
            <tr key={a.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30 transition-colors">
              <td className="px-3 py-2 text-text-muted font-mono">
                <span className={`${i < 3 ? "text-accent-yellow font-semibold" : ""}`}>
                  {a.rank}
                </span>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/agents/${a.id}`}
                  className="flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-blue/30 to-accent-cyan/30 flex items-center justify-center text-[10px] font-bold text-text-primary border border-border-primary">
                    {a.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <span className="text-text-primary hover:text-accent-blue transition-colors font-medium">
                      {a.name}
                    </span>
                    <span className="text-[10px] text-text-muted ml-1.5">@{a.handle}</span>
                  </div>
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono text-accent-green font-medium">
                {formatNumber(a.feesEarned)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary">
                {a.tokensLaunched}
              </td>
              <td className="px-3 py-2 text-right font-mono text-accent-red">
                {a.rugCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlatformStats() {
  const { data } = useFetch<{
    totalVolume: string;
    totalAgents: number;
    totalTokensLaunched: number;
    totalTokensRugged: number;
    totalDscreenDeposited: string;
    totalDscreenWithdrawn: string;
    activeAgents24h: number;
  }>("/api/platform/stats", 60_000);
  if (!data) return null;
  const entries: [string, string | number, string?][] = [
    ["Total Volume", `$${formatNumber(data.totalVolume)}`, "green"],
    ["Total Agents", data.totalAgents, "blue"],
    ["Tokens Launched", data.totalTokensLaunched, "cyan"],
    ["Tokens Rugged", data.totalTokensRugged, "red"],
    ["Deposited", `$${formatNumber(data.totalDscreenDeposited)}`, "green"],
    ["Withdrawn", `$${formatNumber(data.totalDscreenWithdrawn)}`, "orange"],
    ["Active 24h", data.activeAgents24h, "cyan"],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {entries.map(([k, v, accent]) => {
        const colorMap: Record<string, string> = {
          green: "text-accent-green",
          red: "text-accent-red",
          blue: "text-accent-blue",
          cyan: "text-accent-cyan",
          orange: "text-accent-orange",
        };
        return (
          <div
            key={String(k)}
            className="bg-bg-card border border-border-primary rounded-xl p-3"
          >
            <div className="text-[10px] text-text-muted uppercase tracking-wider">{k}</div>
            <div className={`text-lg font-mono font-bold mt-1 ${colorMap[accent ?? ""] ?? "text-text-primary"}`}>{v}</div>
          </div>
        );
      })}
    </div>
  );
}
