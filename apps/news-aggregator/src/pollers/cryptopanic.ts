import axios from "axios";
import { config } from "../config.js";
import { db, schema } from "@degenscreener/db";
import { eq } from "drizzle-orm";

interface CryptoPanicPost {
  title: string;
  url: string;
  source: { title: string };
  published_at: string;
  currencies?: { code: string; title: string }[];
  votes: { positive: number; negative: number; important: number };
}

export async function pollCryptoPanic() {
  if (!config.cryptoPanicApiKey) return;

  try {
    // Fetch hot and rising posts
    const [hotResp, risingResp] = await Promise.allSettled([
      axios.get("https://cryptopanic.com/api/v1/posts/", {
        params: { auth_token: config.cryptoPanicApiKey, filter: "hot", public: true },
        timeout: 10000,
      }),
      axios.get("https://cryptopanic.com/api/v1/posts/", {
        params: { auth_token: config.cryptoPanicApiKey, filter: "rising", public: true },
        timeout: 10000,
      }),
    ]);

    const posts: CryptoPanicPost[] = [];
    if (hotResp.status === "fulfilled") posts.push(...(hotResp.value.data?.results ?? []));
    if (risingResp.status === "fulfilled") posts.push(...(risingResp.value.data?.results ?? []));

    let inserted = 0;
    for (const post of posts) {
      // Dedup by URL
      const existing = await db
        .select({ id: schema.newsItems.id })
        .from(schema.newsItems)
        .where(eq(schema.newsItems.url, post.url))
        .limit(1);
      if (existing.length > 0) continue;

      // Compute raw sentiment from votes
      const total = post.votes.positive + post.votes.negative + 1;
      const sentiment = ((post.votes.positive - post.votes.negative) / total).toFixed(2);

      await db.insert(schema.newsItems).values({
        headline: post.title,
        source: "cryptopanic",
        url: post.url,
        category: "crypto",
        sentiment,
      });
      inserted++;
    }

    console.log(`[cryptopanic] Inserted ${inserted} new items (${posts.length} total fetched)`);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      console.warn("[cryptopanic] Rate limited — skipping this cycle");
      return;
    }
    console.error("[cryptopanic] Poll error:", err);
  }
}
