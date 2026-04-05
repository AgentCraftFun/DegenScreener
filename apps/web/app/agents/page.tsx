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
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 border-b border-border-primary">
          {[
            { k: "all", l: "All" },
            { k: "DEV", l: "Dev" },
            { k: "DEGEN", l: "Degen" },
          ].map((x) => (
            <button
              key={x.k}
              onClick={() => setTypeFilter(x.k)}
              className={`px-3 py-1.5 text-sm ${
                typeFilter === x.k
                  ? "text-text-primary border-b-2 border-accent-blue -mb-px"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {x.l}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-bg-card border border-border-primary rounded px-3 py-1.5 text-sm ml-auto"
        >
          <option value="pnl">Best P&L</option>
          <option value="balance">Balance</option>
          <option value="volume">Volume</option>
          <option value="created_at">Newest</option>
        </select>
      </div>
      {loading ? (
        <div className="text-center text-text-secondary py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data?.agents ?? []).map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="bg-bg-card border border-border-primary rounded p-4 hover:border-accent-blue transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-text-primary">{a.name}</div>
                  <div className="text-xs text-text-secondary">@{a.handle}</div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    a.type === "DEV"
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "bg-accent-purple/20 text-accent-purple"
                  }`}
                >
                  {a.type}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-text-secondary">P&L</span>
                <span
                  className={`font-mono ${
                    Number(a.totalPnl) >= 0
                      ? "text-accent-green"
                      : "text-accent-red"
                  }`}
                >
                  {Number(a.totalPnl) >= 0 ? "+" : ""}
                  {formatNumber(a.totalPnl)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-text-secondary">Volume</span>
                <span className="font-mono text-text-secondary">
                  {formatNumber(a.totalVolume)}
                </span>
              </div>
              {a.type === "DEV" ? (
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Launched / Rugged</span>
                  <span className="font-mono text-text-secondary">
                    {a.tokensLaunched} / {a.rugCount}
                  </span>
                </div>
              ) : null}
              {a.balance !== undefined && (
                <div className="mt-1 flex items-center justify-between text-xs pt-2 border-t border-border-primary">
                  <span className="text-text-secondary">Balance</span>
                  <span className="font-mono text-accent-blue">
                    {formatNumber(a.balance)}
                  </span>
                </div>
              )}
              <div
                className={`mt-2 text-[10px] inline-block px-2 py-0.5 rounded ${
                  a.status === "ACTIVE"
                    ? "bg-accent-green/20 text-accent-green"
                    : "bg-accent-red/20 text-accent-red"
                }`}
              >
                {a.status}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
