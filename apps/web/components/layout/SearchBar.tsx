"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Result {
  id: string;
  label: string;
  href: string;
  sub: string;
  type: "token" | "agent";
}

export function SearchBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const [tokRes, agRes] = await Promise.all([
          fetch(`/api/tokens?limit=5`).then((r) => r.json()),
          fetch(`/api/agents?limit=5`).then((r) => r.json()),
        ]);
        const needle = q.toLowerCase();
        const results: Result[] = [];
        for (const t of tokRes.tokens ?? []) {
          if (
            t.ticker.toLowerCase().includes(needle) ||
            t.name.toLowerCase().includes(needle)
          ) {
            results.push({
              id: t.id,
              label: t.ticker,
              href: `/tokens/${t.id}`,
              sub: t.name,
              type: "token",
            });
          }
        }
        for (const a of agRes.agents ?? []) {
          if (
            a.name.toLowerCase().includes(needle) ||
            a.handle.toLowerCase().includes(needle)
          ) {
            results.push({
              id: a.id,
              label: a.name,
              href: `/agents/${a.id}`,
              sub: `@${a.handle}`,
              type: "agent",
            });
          }
        }
        setResults(results.slice(0, 8));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search tokens, agents..."
          className="w-full bg-bg-primary border border-border-primary rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/50 focus:bg-bg-card transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-bg-card border border-border-primary rounded-lg shadow-dropdown z-50 max-h-80 overflow-y-auto animate-fade-in">
          {results.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover text-[12px] transition-colors first:rounded-t-lg last:rounded-b-lg"
              onClick={() => setOpen(false)}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                r.type === "token" ? "bg-accent-green/20 text-accent-green" : "bg-accent-purple/20 text-accent-purple"
              }`}>
                {r.type === "token" ? "$" : "@"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary font-medium truncate">{r.label}</div>
                <div className="text-[10px] text-text-muted truncate">{r.sub}</div>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-text-muted bg-bg-primary px-1.5 py-0.5 rounded">
                {r.type}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
