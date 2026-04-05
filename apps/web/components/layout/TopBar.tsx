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
    // try to fetch profile on mount (silent)
    apiGet<{ user: { id: string; walletAddress: string; internalBalance: string } }>(
      "/api/user/profile",
    )
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, [setUser]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Dev-only: simulate wallet connect via mock API
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
    <div className="border-b border-border-primary bg-bg-secondary">
      <TickerMarquee />
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="hidden sm:inline">{status}</span>
        </div>
        <div className="flex-1 max-w-xl">
          <SearchBar />
        </div>
        <NotificationBell />
        {isConnected ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-text-secondary hidden md:inline">
              {Number(internalBalance).toFixed(2)} DSCREEN
            </span>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 bg-bg-card border border-border-primary rounded text-text-primary hover:border-accent-blue transition-colors text-xs font-mono"
            >
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-1.5 bg-accent-blue text-white rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}
