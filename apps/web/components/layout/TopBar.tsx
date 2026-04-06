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

  return (
    <div className="bg-bg-secondary border-b border-border-primary">
      {/* Ticker */}
      <TickerMarquee />

      {/* Main bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Status */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mr-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          <span className="hidden sm:inline capitalize">{status}</span>
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
              <div className="hidden md:flex items-center gap-1.5 bg-bg-card border border-border-primary rounded-lg px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                <span className="font-mono text-[11px] text-accent-green font-medium">
                  {Number(internalBalance).toFixed(2)}
                </span>
                <span className="text-[10px] text-text-muted">DSCREEN</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-card border border-border-primary rounded-lg text-text-primary hover:border-border-hover hover:bg-bg-hover text-[11px] font-mono transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-1.5 bg-gradient-to-r from-accent-blue to-accent-cyan text-white rounded-lg text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-glow"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
