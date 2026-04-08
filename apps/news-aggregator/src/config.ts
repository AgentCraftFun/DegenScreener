/** News aggregator configuration — all from environment variables. */

export const config = {
  // API Keys
  cryptoPanicApiKey: process.env.CRYPTOPANIC_API_KEY ?? "",
  newsApiKey: process.env.NEWSAPI_KEY ?? "",
  redditClientId: process.env.REDDIT_CLIENT_ID ?? "",
  redditClientSecret: process.env.REDDIT_CLIENT_SECRET ?? "",

  // Redis + Postgres (shared with worker)
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Poll intervals (cron expressions)
  cryptoPanicInterval: "*/2 * * * *", // every 2 minutes
  newsApiInterval: "*/15 * * * *", // every 15 minutes (free tier safe)
  redditInterval: "*/3 * * * *", // every 3 minutes
  rssInterval: "*/5 * * * *", // every 5 minutes

  // Pipeline
  memabilityThreshold: 5, // topics below this score are excluded from prompts
  topicStaleHours: 6, // topics older than this with declining velocity are stale
  maxTrendsInRedis: 50, // top N trends stored in Redis sorted sets
  trendTtlSeconds: 86400, // 24 hours

  // LLM (for topic extraction + memability scoring)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  llmMaxCallsPerMinute: 5,

  // Content moderation blocklist
  blockedKeywords: [
    "mass shooting",
    "school shooting",
    "child abuse",
    "child trafficking",
    "genocide",
    "suicide bombing",
    "terrorist attack casualties",
  ],
} as const;

export function logMissingKeys() {
  const optional: [string, string][] = [
    ["CRYPTOPANIC_API_KEY", config.cryptoPanicApiKey],
    ["NEWSAPI_KEY", config.newsApiKey],
    ["REDDIT_CLIENT_ID", config.redditClientId],
    ["ANTHROPIC_API_KEY", config.anthropicApiKey],
  ];
  for (const [name, val] of optional) {
    if (!val) console.warn(`[news-aggregator] ${name} not set — poller will be skipped`);
  }
}
