"use client";
import { useState } from "react";
import { TwitterFeed } from "../twitter/TwitterFeed";

export function TwitterSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-16 right-4 z-50 bg-bg-card border border-accent-green/20 text-accent-green rounded w-10 h-10 flex items-center justify-center shadow-glow hover:bg-bg-hover hover:border-accent-green/40 hover:shadow-glow-green transition-all"
        aria-label="Twitter feed"
        title="Toggle Twitter Feed"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      {/* Slide-out panel */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-80 bg-bg-secondary border-l border-accent-green/20 z-50 transition-transform duration-200 shadow-glow-green ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-green" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <h2 className="text-[13px] font-semibold text-accent-green text-glow-green">Feed</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded text-text-muted hover:text-accent-green hover:bg-bg-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-3rem)]">
          <TwitterFeed />
        </div>
      </aside>
    </>
  );
}
