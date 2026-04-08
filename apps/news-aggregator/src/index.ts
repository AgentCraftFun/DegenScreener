import { Redis } from "ioredis";
import cron from "node-cron";
import { config, logMissingKeys } from "./config.js";
import { pollCryptoPanic } from "./pollers/cryptopanic.js";
import { pollNewsApi } from "./pollers/newsapi.js";
import { pollReddit } from "./pollers/reddit.js";
import { pollRssFeeds } from "./pollers/rss.js";
import { runDedup } from "./pipeline/dedup.js";
import { extractTopics } from "./pipeline/topic-extraction.js";
import { scoreMemability } from "./pipeline/memability.js";
import { updateVelocity } from "./pipeline/velocity.js";
import { updateTrendStore } from "./pipeline/trend-store.js";

async function main() {
  console.log("[news-aggregator] Starting...");
  logMissingKeys();

  const redis = new Redis(config.redisUrl, { lazyConnect: true });
  await redis.connect();
  console.log("[news-aggregator] Connected to Redis");

  // Run the full pipeline after each poll cycle
  async function runPipeline() {
    try {
      await runDedup();
      await extractTopics();
      await scoreMemability();
      await updateVelocity();
      await updateTrendStore(redis);
    } catch (err) {
      console.error("[news-aggregator] Pipeline error:", err);
    }
  }

  // Schedule pollers
  if (config.cryptoPanicApiKey) {
    cron.schedule(config.cryptoPanicInterval, async () => {
      console.log("[poller] CryptoPanic tick");
      await pollCryptoPanic();
      await runPipeline();
    });
    console.log("[news-aggregator] CryptoPanic poller scheduled");
  }

  if (config.newsApiKey) {
    cron.schedule(config.newsApiInterval, async () => {
      console.log("[poller] NewsAPI tick");
      await pollNewsApi();
      await runPipeline();
    });
    console.log("[news-aggregator] NewsAPI poller scheduled");
  }

  if (config.redditClientId && config.redditClientSecret) {
    cron.schedule(config.redditInterval, async () => {
      console.log("[poller] Reddit tick");
      await pollReddit();
      await runPipeline();
    });
    console.log("[news-aggregator] Reddit poller scheduled");
  }

  // RSS always runs — no API key needed
  cron.schedule(config.rssInterval, async () => {
    console.log("[poller] RSS tick");
    await pollRssFeeds();
    await runPipeline();
  });
  console.log("[news-aggregator] RSS poller scheduled");

  // Run initial poll on startup
  console.log("[news-aggregator] Running initial poll cycle...");
  const results = await Promise.allSettled([
    config.cryptoPanicApiKey ? pollCryptoPanic() : Promise.resolve(),
    config.newsApiKey ? pollNewsApi() : Promise.resolve(),
    config.redditClientId ? pollReddit() : Promise.resolve(),
    pollRssFeeds(),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[news-aggregator] Initial poll error:", r.reason);
  }
  await runPipeline();
  console.log("[news-aggregator] Initial poll complete. Cron jobs active.");

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("[news-aggregator] Shutting down...");
    redis.disconnect();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    redis.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[news-aggregator] Fatal:", err);
  process.exit(1);
});
