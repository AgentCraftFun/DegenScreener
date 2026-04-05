"use client";
import { useState } from "react";
import { TwitterFeed } from "../twitter/TwitterFeed";

export function TwitterSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed bottom-20 right-4 z-50 bg-accent-blue text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
        aria-label="Twitter feed"
      >
        ◱
      </button>
      <aside
        className={`fixed lg:static top-0 right-0 h-full w-80 bg-bg-secondary border-l border-border-primary z-40 transition-transform ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-border-primary flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Twitter Feed</h2>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-3.5rem)]">
          <TwitterFeed />
        </div>
      </aside>
    </>
  );
}
