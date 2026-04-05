"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMarketStore } from "../../stores/market-store";
import { apiGet } from "../../hooks/useApi";
import { formatPrice, formatNumber, formatPct, formatRelative } from "../../lib/format";

const TABS = [
  { key: "new", label: "New Pairs" },
  { key: "trending", label: "Trending" },
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "rugged", label: "Rugged" },
];

export default function MarketsPage() {
  const [filter, setFilter] = useState("trending");
  const [loading, setLoading] = useState(false);
  const tokens = useMarketStore((s) => s.tokens);
  const setTokens = useMarketStore((s) => s.setTokens);

  useEffect(() => {
    setLoading(true);
    apiGet<{ tokens: unknown[] }>(`/api/tokens?filter=${filter}&limit=50`)
      .then((r) => setTokens(r.tokens as never))
      .finally(() => setLoading(false));
  }, [filter, setTokens]);

  const list = Array.from(tokens.values());

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4 border-b border-border-primary overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm transition-colors whitespace-nowrap ${
              filter === t.key
                ? "text-text-primary border-b-2 border-accent-blue -mb-px"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-bg-card border border-border-primary rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-secondary border-b border-border-primary">
              <th className="text-left px-3 py-2">Token</th>
              <th className="text-right px-3 py-2">Price</th>
              <th className="text-right px-3 py-2">24h</th>
              <th className="text-right px-3 py-2 hidden md:table-cell">Volume</th>
              <th className="text-right px-3 py-2 hidden md:table-cell">Market Cap</th>
              <th className="text-right px-3 py-2 hidden lg:table-cell">Age</th>
              <th className="text-left px-3 py-2 hidden lg:table-cell">Creator</th>
            </tr>
          </thead>
          <tbody>
            {loading && list.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-text-secondary">
                  No tokens found
                </td>
              </tr>
            ) : (
              list.map((t) => {
                const pct = Number(t.change24hPct);
                const color =
                  pct > 0
                    ? "text-accent-green"
                    : pct < 0
                      ? "text-accent-red"
                      : "text-text-secondary";
                return (
                  <tr
                    key={t.id}
                    className="border-b border-border-primary hover:bg-bg-secondary transition-colors"
                  >
                    <td className="px-3 py-3">
                      <Link href={`/tokens/${t.id}`} className="block">
                        <div className="font-semibold text-text-primary">
                          {t.ticker}
                        </div>
                        <div className="text-xs text-text-secondary truncate max-w-[150px]">
                          {t.name}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-primary">
                      {formatPrice(t.price)}
                    </td>
                    <td className={`px-3 py-3 text-right font-mono ${color}`}>
                      {formatPct(t.change24hPct)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary hidden md:table-cell">
                      {formatNumber(t.volume24h)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary hidden md:table-cell">
                      {formatNumber(t.marketCap)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-text-secondary hidden lg:table-cell">
                      {formatRelative(t.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-xs text-text-secondary hidden lg:table-cell">
                      {t.creator?.name ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
