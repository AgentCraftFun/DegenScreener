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
  const [tf, setTf] = useState("1m");
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
      }
    | undefined;
  const creator = tokenData?.creator as { id: string; name: string; handle: string } | null;

  if (!token) {
    return (
      <div className="p-4 text-text-secondary">Loading...</div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{token.ticker}</h1>
          <div className="text-sm text-text-secondary">{token.name}</div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            token.status === "ACTIVE"
              ? "bg-accent-green/20 text-accent-green"
              : "bg-accent-red/20 text-accent-red"
          }`}
        >
          {token.status}
        </span>
      </div>

      <div className="flex gap-2">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => setTf(t)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              tf === t
                ? "bg-accent-blue text-white"
                : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-bg-card border border-border-primary rounded h-[400px]">
        <SimpleChart candles={candles} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Price" value={formatPrice(token.price)} />
        <Stat label="Market Cap" value={formatNumber(token.marketCap)} />
        <Stat label="Total Supply" value={formatNumber(token.totalSupply)} />
        <Stat
          label="Creator"
          value={creator ? creator.name : "—"}
          link={creator ? `/agents/${creator.id}` : undefined}
        />
      </div>

      <div className="border-b border-border-primary flex gap-2">
        {[
          { k: "trades", l: "Trades" },
          { k: "holders", l: "Top Holders" },
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

      {tab === "trades" && (
        <TradesTable trades={(trades?.trades ?? []) as Trade[]} />
      )}
      {tab === "holders" && (
        <HoldersTable holders={(holders?.holders ?? []) as Holder[]} />
      )}
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

function Stat({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string;
}) {
  const inner = (
    <>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-base font-mono text-text-primary mt-1">{value}</div>
    </>
  );
  if (link) {
    return (
      <Link
        href={link}
        className="bg-bg-card border border-border-primary rounded p-3 hover:border-accent-blue block"
      >
        {inner}
      </Link>
    );
  }
  return <div className="bg-bg-card border border-border-primary rounded p-3">{inner}</div>;
}

function TradesTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="bg-bg-card border border-border-primary rounded overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-text-secondary border-b border-border-primary">
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
              <td colSpan={5} className="text-center py-6 text-text-secondary">
                No trades yet
              </td>
            </tr>
          ) : (
            trades.map((t) => (
              <tr key={t.id} className="border-b border-border-primary">
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {formatRelative(t.createdAt)}
                </td>
                <td
                  className={`px-3 py-2 text-xs font-semibold ${
                    t.type === "BUY" ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {t.type}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatNumber(t.dscreenAmount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-text-secondary">
                  {formatNumber(t.tokenAmount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatPrice(t.priceAtTrade)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HoldersTable({ holders }: { holders: Holder[] }) {
  return (
    <div className="bg-bg-card border border-border-primary rounded overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-text-secondary border-b border-border-primary">
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
              <td colSpan={4} className="text-center py-6 text-text-secondary">
                No holders
              </td>
            </tr>
          ) : (
            holders.map((h, i) => (
              <tr
                key={h.agentId + i}
                className="border-b border-border-primary"
              >
                <td className="px-3 py-2 text-text-secondary">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/agents/${h.agentId}`}
                    className="text-text-primary hover:text-accent-blue"
                  >
                    {h.agentName ?? "—"}
                  </Link>
                  <span className="text-xs text-text-secondary ml-2">
                    @{h.handle}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatNumber(h.quantity)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatNumber(h.positionValue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

void formatPct;
