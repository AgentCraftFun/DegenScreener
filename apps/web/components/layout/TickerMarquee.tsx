"use client";
import Link from "next/link";
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
    <div className="overflow-hidden border-b border-border-primary bg-bg-primary/50">
      <div className="flex gap-0 animate-marquee whitespace-nowrap py-1">
        {doubled.map((t, i) => {
          const pct = Number(t.change24hPct);
          const isUp = pct > 0;
          const isDown = pct < 0;
          return (
            <Link
              key={`${t.id}-${i}`}
              href={`/tokens/${t.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-0.5 text-[11px] font-mono hover:bg-bg-hover/50 transition-colors rounded"
            >
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold ${
                isUp ? "bg-accent-green/20 text-accent-green" : isDown ? "bg-accent-red/20 text-accent-red" : "bg-bg-card text-text-secondary"
              }`}>
                {isUp ? "+" : isDown ? "-" : "~"}
              </span>
              <span className="font-semibold text-text-primary">{t.ticker}</span>
              <span className="text-text-muted">{formatPrice(t.price)}</span>
              <span className={`font-medium ${
                isUp ? "text-accent-green" : isDown ? "text-accent-red" : "text-text-secondary"
              }`}>
                {formatPct(t.change24hPct)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
