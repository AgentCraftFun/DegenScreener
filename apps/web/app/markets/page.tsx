"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMarketStore } from "../../stores/market-store";
import { apiGet, useFetch } from "../../hooks/useApi";
import { formatPrice, formatNumber, formatPct, formatRelative } from "../../lib/format";

const FILTERS = [
  { key: "trending", label: "Trending" },
  { key: "new", label: "Newest" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "rugged", label: "Rugged" },
];

const TIME_RANGES = ["5M", "1H", "6H", "24H"];

interface StatsResp {
  totalVolume: string;
  totalAgents: number;
  totalTokensLaunched: number;
  activeAgents24h: number;
}

export default function MarketsPage() {
  const [filter, setFilter] = useState("trending");
  const [timeRange, setTimeRange] = useState("24H");
  const [loading, setLoading] = useState(false);
  const tokens = useMarketStore((s) => s.tokens);
  const setTokens = useMarketStore((s) => s.setTokens);
  const { data: stats } = useFetch<StatsResp>("/api/platform/stats", 60_000);

  useEffect(() => {
    setLoading(true);
    apiGet<{ tokens: unknown[] }>(`/api/tokens?filter=${filter}&limit=50`)
      .then((r) => setTokens(r.tokens as never))
      .finally(() => setLoading(false));
  }, [filter, setTokens]);

  const list = Array.from(tokens.values());

  return (
    <div className="p-3 space-y-3">
      {/* Stats Header */}
      {stats && (
        <div className="flex items-center gap-4 bg-bg-card border border-border-primary rounded px-4 py-2.5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted uppercase tracking-wide">24H Volume:</span>
            <span className="text-sm font-mono font-bold text-accent-green text-glow-green">${formatNumber(stats.totalVolume)}</span>
          </div>
          <div className="w-px h-4 bg-border-primary" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted uppercase tracking-wide">24H Tokens:</span>
            <span className="text-sm font-mono font-bold text-text-primary">{stats.totalTokensLaunched.toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-border-primary hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] text-text-muted uppercase tracking-wide">Active:</span>
            <span className="text-sm font-mono font-bold text-accent-cyan">{stats.activeAgents24h}</span>
          </div>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Time range */}
        <div className="flex items-center bg-bg-card border border-border-primary rounded overflow-hidden">
          <span className="px-2.5 py-1.5 text-[11px] font-semibold text-accent-orange bg-accent-orange/10 border-r border-border-primary">
            Trending
          </span>
          {TIME_RANGES.map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                timeRange === t
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Filter buttons */}
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-medium border transition-all ${
              filter === f.key
                ? "bg-accent-green/10 border-accent-green/30 text-accent-green shadow-glow"
                : "bg-bg-card border-border-primary text-text-secondary hover:border-border-hover hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-primary rounded overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-accent-green/60 border-b border-border-primary bg-bg-secondary/50">
                <th className="text-left px-3 py-2.5 w-8">#</th>
                <th className="text-left px-3 py-2.5">Token</th>
                <th className="text-right px-3 py-2.5">Price</th>
                <th className="text-right px-3 py-2.5 hidden sm:table-cell">Age</th>
                <th className="text-right px-3 py-2.5 hidden md:table-cell">Buys</th>
                <th className="text-right px-3 py-2.5 hidden md:table-cell">Sells</th>
                <th className="text-right px-3 py-2.5 hidden md:table-cell">Volume</th>
                <th className="text-right px-3 py-2.5 hidden lg:table-cell">Makers</th>
                <th className="text-right px-3 py-2.5">5M</th>
                <th className="text-right px-3 py-2.5">1H</th>
                <th className="text-right px-3 py-2.5 hidden sm:table-cell">24H</th>
                <th className="text-right px-3 py-2.5 hidden lg:table-cell">MCap</th>
              </tr>
            </thead>
            <tbody>
              {loading && list.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin text-accent-green" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-text-muted">
                    No tokens found
                  </td>
                </tr>
              ) : (
                list.map((t, idx) => {
                  const pct24 = Number(t.change24hPct);
                  const pct5m = pct24 * 0.05;
                  const pct1h = pct24 * 0.3;
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border-primary/50 hover:bg-bg-hover/50 transition-colors group"
                    >
                      <td className="px-3 py-2 text-text-muted font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/tokens/${t.id}`} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-[10px] font-bold text-accent-green">
                            {t.ticker?.[0] ?? "?"}
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary group-hover:text-accent-green transition-colors">
                              {t.ticker}
                            </div>
                            <div className="text-[10px] text-text-muted truncate max-w-[120px]">
                              {t.name}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary">
                        {formatPrice(t.price)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted hidden sm:table-cell">
                        {formatRelative(t.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">
                        —
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">
                        —
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary hidden md:table-cell">
                        {formatNumber(t.volume24h)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary hidden lg:table-cell">
                        —
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <PctCell value={pct5m} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <PctCell value={pct1h} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono hidden sm:table-cell">
                        <PctCell value={pct24} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary hidden lg:table-cell">
                        ${formatNumber(t.marketCap)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PctCell({ value }: { value: number }) {
  if (!value && value !== 0) return <span className="text-text-muted">—</span>;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span className={`${
      isUp ? "text-accent-green" : isDown ? "text-accent-red" : "text-text-muted"
    }`}>
      {isUp ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}
