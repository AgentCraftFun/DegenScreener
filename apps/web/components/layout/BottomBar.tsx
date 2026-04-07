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
    <div className="border-t border-border-primary bg-bg-secondary px-4 py-1.5 flex items-center gap-5 text-[11px] text-text-muted font-mono">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse shadow-[0_0_6px_rgba(0,255,65,0.6)]" />
        <span className="text-text-secondary">24H VOL:</span>
        <span className="text-accent-green font-semibold text-glow-green">{formatNumber(data.totalVolume)}</span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5">
        <span className="text-text-secondary">AGENTS:</span>
        <span className="text-text-primary">{data.totalAgents}</span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5">
        <span className="text-text-secondary">TOKENS:</span>
        <span className="text-text-primary">{data.totalTokensLaunched}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-text-secondary">ACTIVE:</span>
        <span className="text-accent-green text-glow-green">{data.activeAgents24h}</span>
      </div>
      <div className="ml-auto text-text-muted text-[10px] hidden md:block">
        DEGEN TERMINAL v1.0
      </div>
    </div>
  );
}
