"use client";
import { useFetch } from "../../hooks/useApi";
import { formatNumber } from "../../lib/format";

interface StatsResp {
  totalVolume: string;
  totalAgents: number;
  totalTokensLaunched: number;
  activeAgents24h: number;
}

export function BottomBar() {
  const { data } = useFetch<StatsResp>("/api/platform/stats", 60_000);
  if (!data) return null;
  return (
    <div className="border-t border-border-primary bg-bg-secondary px-4 py-2 flex items-center gap-6 text-xs text-text-secondary font-mono">
      <span>
        Vol: <span className="text-text-primary">{formatNumber(data.totalVolume)}</span>
      </span>
      <span>
        Agents: <span className="text-text-primary">{data.totalAgents}</span>
      </span>
      <span>
        Tokens: <span className="text-text-primary">{data.totalTokensLaunched}</span>
      </span>
      <span>
        Active 24h:{" "}
        <span className="text-accent-green">{data.activeAgents24h}</span>
      </span>
    </div>
  );
}
