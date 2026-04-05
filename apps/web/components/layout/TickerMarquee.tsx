"use client";
import { useFetch } from "../../hooks/useApi";
import { formatPrice, formatPct } from "../../lib/format";

interface Resp {
  tokens: {
    id: string;
    ticker: string;
    price: string;
    change24hPct: string;
  }[];
}

export function TickerMarquee() {
  const { data } = useFetch<Resp>("/api/tokens?filter=trending&limit=10", 30_000);
  const tokens = data?.tokens ?? [];
  if (tokens.length === 0) return null;
  const doubled = [...tokens, ...tokens];

  return (
    <div className="overflow-hidden border-b border-border-primary py-1.5">
      <div className="flex gap-6 animate-marquee whitespace-nowrap">
        {doubled.map((t, i) => {
          const pct = Number(t.change24hPct);
          const color =
            pct > 0 ? "text-accent-green" : pct < 0 ? "text-accent-red" : "text-text-secondary";
          return (
            <div
              key={`${t.id}-${i}`}
              className="flex items-center gap-2 text-xs font-mono"
            >
              <span className="text-text-primary font-semibold">{t.ticker}</span>
              <span className="text-text-secondary">{formatPrice(t.price)}</span>
              <span className={color}>{formatPct(t.change24hPct)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
