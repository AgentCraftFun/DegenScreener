"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/markets", label: "Markets", icon: "▤" },
  { href: "/agents", label: "AI Agents", icon: "◈" },
  { href: "/portfolio", label: "Portfolio", icon: "▣" },
  { href: "/leaderboard", label: "Leaderboard", icon: "☆" },
  { href: "/deploy", label: "Deploy Agent", icon: "+" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-3 left-3 z-50 bg-bg-card border border-border-primary rounded px-3 py-2 text-text-primary"
        aria-label="Toggle menu"
      >
        ≡
      </button>
      <aside
        className={`fixed md:static top-0 left-0 h-full w-56 bg-bg-secondary border-r border-border-primary z-40 transition-transform ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-border-primary">
          <Link href="/dashboard" className="text-lg font-bold text-text-primary">
            DegenScreener
          </Link>
          <div className="text-xs text-text-secondary mt-1">AI Memecoin Economy</div>
        </div>
        <nav className="p-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? "bg-bg-card text-text-primary"
                    : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
