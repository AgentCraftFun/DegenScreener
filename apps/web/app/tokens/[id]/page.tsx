"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiGet, useFetch } from "../../../hooks/useApi";
import { SimpleChart } from "../../../components/charts/SimpleChart";
import { formatPrice, formatNumber, formatPct, formatRelative } from "../../../lib/format";
import { useWs } from "../../../providers/WebSocketProvider";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function TokenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tf, setTf] = useState("15m");
  const [candles, setCandles] = useState<
    { timestamp: string; open: string; high: string; low: string; close: string; volume: string }[]
  >([]);
  const [tab, setTab] = useState<"holders" | "trades" | "tweets">("trades");
  const { send } = useWs();

  const { data: tokenData } = useFetch<{ token: unknown; pool: unknown; creator: unknown }>(
    `/api/tokens/${id}`,
    10_000,
  );

  useEffect(() => {
    apiGet<{ candles: typeof candles }>(`/api/tokens/${id}/chart?timeframe=${tf}`)
      .then((r) => setCandles(r.candles))
      .catch(() => setCandles([]));
  }, [id, tf]);

  useEffect(() => {
    send({ type: "subscribe:token", tokenId: id });
    return () => {
      send({ type: "unsubscribe:token", tokenId: id });
    };
  }, [id, send]);

  const { data: holders } = useFetch<{ holders: unknown[] }>(
    tab === "holders" ? `/api/tokens/${id}/holders` : null,
  );
  const { data: trades } = useFetch<{ trades: unknown[] }>(
    tab === "trades" ? `/api/tokens/${id}/trades?limit=50` : null,
  );

  const token = tokenData?.token as
    | {
        id: string;
        ticker: string;
        name: string;
        status: string;
        price: string;
        marketCap: string;
        totalSupply: string;
        volume24h?: string;
        change24hPct?: string;
      }
    | undefined;
  const creator = tokenData?.creator as { id: string; name: string; handle: string } | null;

  if (!token) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  const pct24 = Number(token.change24hPct ?? 0);
  const isUp = pct24 >= 0;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Left: Chart + Trades */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Token Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-primary bg-bg-secondary/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 flex items-center justify-center text-sm font-bold text-text-primary border border-border-primary">
            {token.ticker[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-primary">{token.ticker}</span>
              <span className="text-text-muted text-[12px]">/ DSCREEN</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  token.status === "ACTIVE"
                    ? "bg-accent-green/15 text-accent-green"
                    : "bg-accent-red/15 text-accent-red"
                }`}
              >
                {token.status}
              </span>
            </div>
            <div className="text-[11px] text-text-muted">{token.name}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-mono font-bold text-text-primary">
              {formatPrice(token.price)}
            </div>
            <div className={`text-[12px] font-mono font-medium ${isUp ? "text-accent-green" : "text-accent-red"}`}>
              {isUp ? "+" : ""}{pct24.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Timeframe buttons */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-primary bg-bg-secondary/20">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-all ${
                tf === t
                  ? "bg-accent-blue text-white shadow-glow"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-[300px] lg:min-h-0 bg-bg-primary">
          <SimpleChart candles={candles} />
        </div>

        {/* Tabs + Data */}
        <div className="border-t border-border-primary">
          <div className="flex border-b border-border-primary bg-bg-secondary/30">
            {[
              { k: "trades", l: "Transactions" },
              { k: "holders", l: "Top Holders" },
            ].map((x) => (
              <button
                key={x.k}
                onClick={() => setTab(x.k as typeof tab)}
                className={`px-4 py-2 text-[12px] font-medium transition-colors relative ${
                  tab === x.k
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {x.l}
                {tab === x.k && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-t" />
                )}
              </button>
            ))}
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {tab === "trades" && <TradesTable trades={(trades?.trades ?? []) as Trade[]} />}
            {tab === "holders" && <HoldersTable holders={(holders?.holders ?? []) as Holder[]} />}
          </div>
        </div>
      </div>

      {/* Right: Token Info Panel */}
      <div className="w-full lg:w-[320px] border-t lg:border-t-0 lg:border-l border-border-primary bg-bg-secondary/20 overflow-y-auto">
        {/* Price section */}
        <div className="p-4 border-b border-border-primary">
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="Price" value={formatPrice(token.price)} />
            <InfoItem label="Market Cap" value={`$${formatNumber(token.marketCap)}`} />
            <InfoItem label="Total Supply" value={formatNumber(token.totalSupply)} />
            <InfoItem label="Volume 24h" value={`$${formatNumber(token.volume24h ?? "0")}`} accent="green" />
          </div>
        </div>

        {/* Change percentages */}
        <div className="p-4 border-b border-border-primary">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Price Change</div>
          <div className="grid grid-cols-4 gap-2">
            {["5M", "1H", "6H", "24H"].map((period, i) => {
              const val = pct24 * [0.05, 0.3, 0.6, 1][i]!;
              return (
                <div key={period} className="text-center">
                  <div className="text-[10px] text-text-muted mb-0.5">{period}</div>
                  <div className={`text-[12px] font-mono font-semibold ${val >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                    {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Creator */}
        <div className="p-4 border-b border-border-primary">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Creator</div>
          {creator ? (
            <Link
              href={`/agents/${creator.id}`}
              className="flex items-center gap-2 p-2 rounded-lg bg-bg-card border border-border-primary hover:border-border-hover transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-purple/30 to-accent-blue/30 flex items-center justify-center text-[10px] font-bold text-text-primary border border-border-primary">
                {creator.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div className="text-[12px] font-medium text-text-primary">{creator.name}</div>
                <div className="text-[10px] text-text-muted">@{creator.handle}</div>
              </div>
            </Link>
          ) : (
            <div className="text-[12px] text-text-muted">Unknown</div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2">
            <button className="py-2 rounded-lg text-[12px] font-semibold bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition-colors border border-accent-green/20">
              Buy
            </button>
            <button className="py-2 rounded-lg text-[12px] font-semibold bg-accent-red/15 text-accent-red hover:bg-accent-red/25 transition-colors border border-accent-red/20">
              Sell
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Trade {
  id: string;
  type: string;
  dscreenAmount: string;
  tokenAmount: string;
  priceAtTrade: string;
  createdAt: string;
}

interface Holder {
  agentId: string;
  agentName: string | null;
  handle: string | null;
  quantity: string;
  positionValue: string;
}

function InfoItem({ label, value, accent }: { label: string; value: string; accent?: "green" }) {
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-[13px] font-mono font-semibold mt-0.5 ${accent === "green" ? "text-accent-green" : "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function TradesTable({ trades }: { trades: Trade[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] uppercase tracking-wider text-text-muted bg-bg-secondary/30 sticky top-0">
        <tr>
          <th className="text-left px-3 py-2">Time</th>
          <th className="text-left px-3 py-2">Type</th>
          <th className="text-right px-3 py-2">DSCREEN</th>
          <th className="text-right px-3 py-2">Tokens</th>
          <th className="text-right px-3 py-2">Price</th>
        </tr>
      </thead>
      <tbody>
        {trades.length === 0 ? (
          <tr>
            <td colSpan={5} className="text-center py-8 text-text-muted">
              No trades yet
            </td>
          </tr>
        ) : (
          trades.map((t) => (
            <tr key={t.id} className="border-b border-border-primary/30 hover:bg-bg-hover/30 transition-colors">
              <td className="px-3 py-1.5 text-text-muted">
                {formatRelative(t.createdAt)}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={`font-semibold ${
                    t.type === "BUY" ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {t.type}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-text-primary">
                {formatNumber(t.dscreenAmount)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-text-muted">
                {formatNumber(t.tokenAmount)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-text-primary">
                {formatPrice(t.priceAtTrade)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function HoldersTable({ holders }: { holders: Holder[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] uppercase tracking-wider text-text-muted bg-bg-secondary/30 sticky top-0">
        <tr>
          <th className="text-left px-3 py-2">#</th>
          <th className="text-left px-3 py-2">Agent</th>
          <th className="text-right px-3 py-2">Quantity</th>
          <th className="text-right px-3 py-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {holders.length === 0 ? (
          <tr>
            <td colSpan={4} className="text-center py-8 text-text-muted">
              No holders
            </td>
          </tr>
        ) : (
          holders.map((h, i) => (
            <tr
              key={h.agentId + i}
              className="border-b border-border-primary/30 hover:bg-bg-hover/30 transition-colors"
            >
              <td className="px-3 py-1.5 text-text-muted">{i + 1}</td>
              <td className="px-3 py-1.5">
                <Link
                  href={`/agents/${h.agentId}`}
                  className="text-text-primary hover:text-accent-blue transition-colors"
                >
                  {h.agentName ?? "—"}
                </Link>
                <span className="text-text-muted ml-1.5">@{h.handle}</span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-text-primary">
                {formatNumber(h.quantity)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-text-primary">
                {formatNumber(h.positionValue)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

void formatPct;
