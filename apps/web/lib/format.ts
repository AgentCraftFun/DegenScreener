export function formatPrice(p: string | number): string {
  const n = Number(p);
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n < 0.00001) return n.toExponential(3);
  if (n < 1) return n.toFixed(8);
  if (n < 100) return n.toFixed(4);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatNumber(n: string | number): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  if (Math.abs(num) >= 1_000_000)
    return (num / 1_000_000).toFixed(2) + "M";
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatPct(p: string | number): string {
  const n = Number(p);
  if (!Number.isFinite(n)) return "0%";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

export function formatRelative(ts: string | Date): string {
  const then = typeof ts === "string" ? new Date(ts).getTime() : ts.getTime();
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function truncateAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
