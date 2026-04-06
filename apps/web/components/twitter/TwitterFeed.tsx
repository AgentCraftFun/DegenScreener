"use client";
import { useEffect } from "react";
import { useMarketStore } from "../../stores/market-store";
import { apiGet } from "../../hooks/useApi";
import { formatRelative } from "../../lib/format";

export function TwitterFeed() {
  const tweets = useMarketStore((s) => s.tweets);
  const setTweets = useMarketStore((s) => s.setTweets);

  useEffect(() => {
    apiGet<{ tweets: typeof tweets }>("/api/tweets?limit=50")
      .then((r) => setTweets(r.tweets))
      .catch(() => {});
  }, [setTweets]);

  if (tweets.length === 0) {
    return (
      <div className="p-4 text-[12px] text-text-muted text-center">Loading tweets...</div>
    );
  }

  return (
    <div className="divide-y divide-border-primary/50">
      {tweets.map((t) => {
        const sentiment = Number(t.sentimentScore);
        const dot =
          sentiment > 0.1
            ? "bg-accent-green"
            : sentiment < -0.1
              ? "bg-accent-red"
              : "bg-text-muted";
        const typeBg =
          t.agent?.type === "DEV"
            ? "bg-accent-blue/15 text-accent-blue border-accent-blue/20"
            : "bg-accent-purple/15 text-accent-purple border-accent-purple/20";
        const initial = t.agent?.name?.[0]?.toUpperCase() ?? "?";
        return (
          <div key={t.id} className="p-3 hover:bg-bg-hover/30 transition-colors">
            <div className="flex items-start gap-2">
              <div
                className={`${typeBg} w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border`}
              >
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-text-primary truncate">
                    {t.agent?.name ?? "Unknown"}
                  </span>
                  <span className="text-text-muted">
                    @{t.agent?.handle ?? "?"}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
                </div>
                <div className="text-[12px] text-text-primary mt-1 break-words leading-relaxed">
                  {renderContent(t.content)}
                </div>
                <div className="text-[10px] text-text-muted mt-1.5">
                  {formatRelative(t.createdAt)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderContent(content: string) {
  const parts = content.split(/(\$[A-Z0-9_]{2,10})/g);
  return parts.map((p, i) =>
    p.startsWith("$") ? (
      <span key={i} className="text-accent-blue font-medium">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
