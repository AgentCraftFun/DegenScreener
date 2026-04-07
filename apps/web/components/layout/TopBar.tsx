"use client";
import { useEffect, useState } from "react";
import { apiGet } from "../../hooks/useApi";
import { useAuthStore } from "../../stores/auth-store";
import { useWs } from "../../providers/WebSocketProvider";
import { NotificationBell } from "../notifications/NotificationBell";
import { TickerMarquee } from "./TickerMarquee";
import { SearchBar } from "./SearchBar";

export function TopBar() {
  const { walletAddress, internalBalance, isConnected, setUser, clearUser } =
    useAuthStore();
  const { status } = useWs();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet<{ user: { id: string; walletAddress: string; internalBalance: string } }>(
      "/api/user/profile",
    )
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, [setUser]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      alert(
        "Connect wallet via MetaMask/RainbowKit. For testing, use the smoke test script to create a session.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearUser();
  };

  const statusColor =
    status === "connected"
      ? "bg-accent-green"
      : status === "reconnecting"
        ? "bg-accent-yellow"
        : "bg-accent-red";

  const statusGlow =
    status === "connected"
      ? "shadow-[0_0_6px_rgba(0,255,65,0.6)]"
      : status === "reconnecting"
        ? "shadow-[0_0_6px_rgba(245,166,35,0.6)]"
        : "shadow-[0_0_6px_rgba(255,59,59,0.6)]";

  return (
    <div className="bg-bg-secondary border-b border-border-primary">
      {/* Ticker */}
      <TickerMarquee />

      {/* Main bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Status */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mr-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${statusGlow}`} />
          <span className="hidden sm:inline capitalize text-text-secondary">{status}</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-lg">
          <SearchBar />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 ml-auto">
          <NotificationBell />

          {isConnected ? (
            <div className="flex items-center gap-1.5">
              <div className="hidden md:flex items-center gap-1.5 bg-bg-card border border-accent-green/20 rounded px-2.5 py-1 shadow-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_rgba(0,255,65,0.6)]" />
                <span className="font-mono text-[11px] text-accent-green font-medium text-glow-green">
                  {Number(internalBalance).toFixed(2)}
                </span>
                <span className="text-[10px] text-text-muted">DSCREEN</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-card border border-border-primary rounded text-text-primary hover:border-accent-green/40 hover:bg-bg-hover text-[11px] font-mono transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_rgba(0,255,65,0.6)]" />
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-1.5 bg-accent-green/15 border border-accent-green/40 text-accent-green rounded text-[12px] font-semibold hover:bg-accent-green/25 hover:shadow-glow-green transition-all disabled:opacity-50 text-glow-green"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
