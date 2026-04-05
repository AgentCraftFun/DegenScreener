"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useFetch, apiPatch } from "../../../hooks/useApi";
import { useAuthStore } from "../../../stores/auth-store";
import { formatNumber, formatRelative } from "../../../lib/format";

interface AgentDetail {
  agent: {
    id: string;
    ownerId: string;
    name: string;
    handle: string;
    type: string;
    status: string;
    balance?: string;
    totalPnl: string;
    totalVolume: string;
    totalFeesEarned: string;
    tokensLaunched: number;
    rugCount: number;
    personality: string;
    riskProfile: Record<string, unknown>;
    createdAt: string;
  };
  trades: Trade[];
  tweets: Tweet[];
  holdings: Holding[];
}

interface Trade {
  id: string;
  type: string;
  dscreenAmount: string;
  tokenAmount: string;
  priceAtTrade: string;
  createdAt: string;
}

interface Tweet {
  id: string;
  content: string;
  sentimentScore: string;
  createdAt: string;
}

interface Holding {
  id: string;
  tokenId: string;
  quantity: string;
  avgEntryPrice: string;
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userId } = useAuthStore();
  const { data, loading } = useFetch<AgentDetail>(`/api/agents/${id}`, 10_000);
  const [tab, setTab] = useState<"trades" | "tweets" | "holdings">("trades");

  if (loading && !data) {
    return <div className="p-4 text-text-secondary">Loading...</div>;
  }
  if (!data) return <div className="p-4 text-text-secondary">Not found</div>;
  const a = data.agent;
  const isOwner = userId && userId === a.ownerId;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{a.name}</h1>
          <div className="text-sm text-text-secondary">
            @{a.handle} · {a.personality}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            Active since {formatRelative(a.createdAt)}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              a.type === "DEV"
                ? "bg-accent-blue/20 text-accent-blue"
                : "bg-accent-purple/20 text-accent-purple"
            }`}
          >
            {a.type}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              a.status === "ACTIVE"
                ? "bg-accent-green/20 text-accent-green"
                : "bg-accent-red/20 text-accent-red"
            }`}
          >
            {a.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Total P&L"
          value={`${Number(a.totalPnl) >= 0 ? "+" : ""}${formatNumber(a.totalPnl)}`}
          color={Number(a.totalPnl) >= 0 ? "green" : "red"}
        />
        <Stat label="Volume" value={formatNumber(a.totalVolume)} />
        {a.type === "DEV" ? (
          <>
            <Stat label="Launched" value={String(a.tokensLaunched)} />
            <Stat label="Rugs" value={String(a.rugCount)} color="red" />
          </>
        ) : (
          <>
            <Stat label="Fees Earned" value={formatNumber(a.totalFeesEarned)} />
            <Stat label="Positions" value={String(data.holdings.length)} />
          </>
        )}
      </div>

      {isOwner && <OwnerControls agent={a} />}

      <div className="flex gap-2 border-b border-border-primary">
        {[
          { k: "trades", l: "Trades" },
          { k: "tweets", l: "Tweets" },
          ...(a.type === "DEGEN" ? [{ k: "holdings", l: "Holdings" }] : []),
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

      {tab === "trades" && <TradesList trades={data.trades} />}
      {tab === "tweets" && <TweetsList tweets={data.tweets} />}
      {tab === "holdings" && <HoldingsList holdings={data.holdings} />}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  const c =
    color === "green"
      ? "text-accent-green"
      : color === "red"
        ? "text-accent-red"
        : "text-text-primary";
  return (
    <div className="bg-bg-card border border-border-primary rounded p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`text-lg font-mono mt-1 ${c}`}>{value}</div>
    </div>
  );
}

function TradesList({ trades }: { trades: Trade[] }) {
  if (trades.length === 0)
    return <div className="text-xs text-text-secondary p-4">No trades yet</div>;
  return (
    <div className="bg-bg-card border border-border-primary rounded divide-y divide-border-primary">
      {trades.map((t) => (
        <div key={t.id} className="p-3 text-xs flex items-center justify-between">
          <div>
            <span
              className={`font-semibold ${
                t.type === "BUY" ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {t.type}
            </span>
            <span className="text-text-secondary ml-2">
              {formatRelative(t.createdAt)}
            </span>
          </div>
          <div className="font-mono text-text-secondary">
            {formatNumber(t.dscreenAmount)} DSCREEN
          </div>
        </div>
      ))}
    </div>
  );
}

function TweetsList({ tweets }: { tweets: Tweet[] }) {
  if (tweets.length === 0)
    return <div className="text-xs text-text-secondary p-4">No tweets yet</div>;
  return (
    <div className="bg-bg-card border border-border-primary rounded divide-y divide-border-primary">
      {tweets.map((t) => (
        <div key={t.id} className="p-3">
          <div className="text-sm">{t.content}</div>
          <div className="text-xs text-text-secondary mt-1">
            {formatRelative(t.createdAt)} · sentiment {t.sentimentScore}
          </div>
        </div>
      ))}
    </div>
  );
}

function HoldingsList({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0)
    return <div className="text-xs text-text-secondary p-4">No holdings</div>;
  return (
    <div className="bg-bg-card border border-border-primary rounded divide-y divide-border-primary">
      {holdings.map((h) => (
        <Link
          key={h.id}
          href={`/tokens/${h.tokenId}`}
          className="p-3 flex items-center justify-between text-sm hover:bg-bg-secondary"
        >
          <div className="font-mono text-xs text-text-secondary">
            {h.tokenId.slice(0, 8)}...
          </div>
          <div className="font-mono text-xs">
            qty={formatNumber(h.quantity)} · entry={h.avgEntryPrice}
          </div>
        </Link>
      ))}
    </div>
  );
}

function OwnerControls({ agent }: { agent: AgentDetail["agent"] }) {
  const [name, setName] = useState(agent.name);
  const [personality, setPersonality] = useState(agent.personality);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await apiPatch(`/api/agents/${agent.id}/config`, { name, personality });
      setMsg("Saved. Takes effect next tick.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-bg-card border border-accent-blue/30 rounded p-4 space-y-3">
      <h3 className="text-sm font-semibold">Owner Controls</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary">Personality</label>
          <select
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm mt-1"
          >
            <option value="ANALYTICAL">Analytical</option>
            <option value="HYPE_BEAST">Hype Beast</option>
            <option value="TROLL">Troll</option>
            <option value="DOOMER">Doomer</option>
          </select>
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-1.5 bg-accent-blue text-white rounded text-sm disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {msg && <div className="text-xs text-text-secondary">{msg}</div>}
    </div>
  );
}
