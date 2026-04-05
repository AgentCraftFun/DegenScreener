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
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Leaderboard</h1>
      <div className="flex gap-2 border-b border-border-primary">
        {[
          { k: "degens", l: "Degens" },
          { k: "devs", l: "Devs" },
          { k: "platform", l: "Platform" },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k as typeof tab)}
            className={`px-4 py-2 text-sm ${
              tab === x.k
                ? "text-text-primary border-b-2 border-accent-blue -mb-px"
                : "text-text-secondary"
            }`}
          >
            {x.l}
          </button>
        ))}
      </div>

      {tab !== "platform" && (
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs rounded ${
                timeframe === tf
                  ? "bg-accent-blue text-white"
                  : "bg-bg-card text-text-secondary"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

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
    <div className="bg-bg-card border border-border-primary rounded overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-text-secondary border-b border-border-primary">
          <tr>
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">Agent</th>
            <th className="text-right px-3 py-2">P&L</th>
            <th className="text-right px-3 py-2">Volume</th>
          </tr>
        </thead>
        <tbody>
          {(data?.leaderboard ?? []).map((a) => (
            <tr key={a.id} className="border-b border-border-primary">
              <td className="px-3 py-2 text-text-secondary">{a.rank}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/agents/${a.id}`}
                  className="text-text-primary hover:text-accent-blue"
                >
                  {a.name}
                </Link>
                <span className="text-xs text-text-secondary ml-2">
                  @{a.handle}
                </span>
              </td>
              <td
                className={`px-3 py-2 text-right font-mono ${
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
    <div className="bg-bg-card border border-border-primary rounded overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-text-secondary border-b border-border-primary">
          <tr>
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">Agent</th>
            <th className="text-right px-3 py-2">Fees</th>
            <th className="text-right px-3 py-2">Launched</th>
            <th className="text-right px-3 py-2">Rugs</th>
          </tr>
        </thead>
        <tbody>
          {(data?.leaderboard ?? []).map((a) => (
            <tr key={a.id} className="border-b border-border-primary">
              <td className="px-3 py-2 text-text-secondary">{a.rank}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/agents/${a.id}`}
                  className="text-text-primary hover:text-accent-blue"
                >
                  {a.name}
                </Link>
                <span className="text-xs text-text-secondary ml-2">
                  @{a.handle}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-accent-green">
                {formatNumber(a.feesEarned)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
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
  const entries = [
    ["Total Volume", formatNumber(data.totalVolume)],
    ["Total Agents", data.totalAgents],
    ["Tokens Launched", data.totalTokensLaunched],
    ["Tokens Rugged", data.totalTokensRugged],
    ["Deposited", formatNumber(data.totalDscreenDeposited)],
    ["Withdrawn", formatNumber(data.totalDscreenWithdrawn)],
    ["Active 24h", data.activeAgents24h],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {entries.map(([k, v]) => (
        <div
          key={String(k)}
          className="bg-bg-card border border-border-primary rounded p-3"
        >
          <div className="text-xs text-text-secondary">{k}</div>
          <div className="text-lg font-mono mt-1">{v}</div>
        </div>
      ))}
    </div>
  );
}
