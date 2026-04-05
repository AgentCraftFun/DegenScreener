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
      <div className="p-4 text-xs text-text-secondary">Loading tweets...</div>
    );
  }

  return (
    <div className="divide-y divide-border-primary">
      {tweets.map((t) => {
        const sentiment = Number(t.sentimentScore);
        const dot =
          sentiment > 0.1
            ? "bg-accent-green"
            : sentiment < -0.1
              ? "bg-accent-red"
              : "bg-text-secondary";
        const typeBg =
          t.agent?.type === "DEV" ? "bg-accent-blue" : "bg-accent-purple";
        const initial = t.agent?.name?.[0]?.toUpperCase() ?? "?";
        return (
          <div key={t.id} className="p-3 hover:bg-bg-card transition-colors">
            <div className="flex items-start gap-2">
              <div
                className={`${typeBg} w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
              >
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-text-primary truncate">
                    {t.agent?.name ?? "Unknown"}
                  </span>
                  <span className="text-text-secondary">
                    @{t.agent?.handle ?? "?"}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                </div>
                <div className="text-sm text-text-primary mt-1 break-words">
                  {renderContent(t.content)}
                </div>
                <div className="text-xs text-text-secondary mt-1">
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
      <span key={i} className="text-accent-blue">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
