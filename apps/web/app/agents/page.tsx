"use client";
import { useState } from "react";
import Link from "next/link";
import { useFetch } from "../../hooks/useApi";
import { formatNumber } from "../../lib/format";

interface Agent {
  id: string;
  name: string;
  handle: string;
  type: string;
  status: string;
  totalPnl: string;
  totalVolume: string;
  tokensLaunched: number;
  rugCount: number;
  balance?: string;
  riskProfile?: Record<string, unknown>;
}

export default function AgentsPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("pnl");
  const { data, loading } = useFetch<{ agents: Agent[] }>(
    `/api/agents?type=${typeFilter}&sort=${sort}&order=desc&limit=50`,
  );

  return (
    <div className="p-3 space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-bg-card border border-border-primary rounded overflow-hidden">
          {[
            { k: "all", l: "All Agents" },
            { k: "DEV", l: "Devs" },
            { k: "DEGEN", l: "Degens" },
          ].map((x) => (
            <button
              key={x.k}
              onClick={() => setTypeFilter(x.k)}
              className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                typeFilter === x.k
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {x.l}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-bg-card border border-border-primary rounded px-3 py-1.5 text-[11px] text-text-secondary ml-auto focus:outline-none focus:border-accent-green/50"
        >
          <option value="pnl">Best P&L</option>
          <option value="balance">Balance</option>
          <option value="volume">Volume</option>
          <option value="created_at">Newest</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted text-[12px]">
          <svg className="w-4 h-4 animate-spin mr-2 text-accent-green" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {(data?.agents ?? []).map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="bg-bg-card border border-border-primary rounded p-3.5 hover:border-accent-green/30 hover:bg-bg-hover/30 transition-all group shadow-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-[11px] font-bold border ${
                    a.type === "DEV"
                      ? "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20"
                      : "bg-accent-purple/10 text-accent-purple border-accent-purple/20"
                  }`}>
                    {a.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div className="font-semibold text-[13px] text-text-primary group-hover:text-accent-green transition-colors">
                      {a.name}
                    </div>
                    <div className="text-[10px] text-text-muted">@{a.handle}</div>
                  </div>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider border ${
                    a.type === "DEV"
                      ? "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20"
                      : "bg-accent-purple/10 text-accent-purple border-accent-purple/20"
                  }`}
                >
                  {a.type}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">P&L</span>
                  <span
                    className={`font-mono font-medium ${
                      Number(a.totalPnl) >= 0 ? "text-accent-green" : "text-accent-red"
                    }`}
                  >
                    {Number(a.totalPnl) >= 0 ? "+" : ""}
                    {formatNumber(a.totalPnl)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Volume</span>
                  <span className="font-mono text-text-secondary">
                    {formatNumber(a.totalVolume)}
                  </span>
                </div>
                {a.type === "DEV" && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">Launched / Rugged</span>
                    <span className="font-mono text-text-secondary">
                      {a.tokensLaunched} / <span className="text-accent-red">{a.rugCount}</span>
                    </span>
                  </div>
                )}
                {a.balance !== undefined && (
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border-primary/50">
                    <span className="text-text-muted">Balance</span>
                    <span className="font-mono text-accent-cyan font-medium">
                      {formatNumber(a.balance)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    a.status === "ACTIVE"
                      ? "bg-accent-green shadow-[0_0_4px_rgba(0,255,65,0.5)]"
                      : "bg-accent-red shadow-[0_0_4px_rgba(255,59,59,0.5)]"
                  }`}
                />
                <span className={`text-[10px] font-medium ${
                  a.status === "ACTIVE" ? "text-accent-green" : "text-accent-red"
                }`}>
                  {a.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
