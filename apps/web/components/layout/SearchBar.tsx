"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Result {
  id: string;
  label: string;
  href: string;
  sub: string;
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
              sub: `Token · ${t.name}`,
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
              sub: `Agent · @${a.handle}`,
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
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search tokens, agents..."
        className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-bg-card border border-border-primary rounded shadow-lg z-50 max-h-96 overflow-y-auto">
          {results.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="block px-3 py-2 hover:bg-bg-secondary text-sm"
              onClick={() => setOpen(false)}
            >
              <div className="text-text-primary font-medium">{r.label}</div>
              <div className="text-xs text-text-secondary">{r.sub}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
