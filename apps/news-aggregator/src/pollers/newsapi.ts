import axios from "axios";
import { config } from "../config.js";
import { db, schema } from "@degenscreener/db";
import { eq } from "drizzle-orm";

const CATEGORIES = ["general", "technology", "entertainment", "science", "health"];
const CATEGORY_MAP: Record<string, string> = {
  general: "politics",
  technology: "tech",
  entertainment: "pop_culture",
  science: "tech",
  health: "world",
  business: "finance",
  sports: "sports",
};

let categoryIndex = 0;

export async function pollNewsApi() {
  if (!config.newsApiKey) return;

  try {
    // Rotate through categories each poll cycle
    const category = CATEGORIES[categoryIndex % CATEGORIES.length]!;
    categoryIndex++;

    const [headlinesResp, cryptoResp] = await Promise.allSettled([
      axios.get("https://newsapi.org/v2/top-headlines", {
        params: { country: "us", category, apiKey: config.newsApiKey, pageSize: 20 },
        timeout: 10000,
      }),
      axios.get("https://newsapi.org/v2/everything", {
        params: {
          q: "crypto OR bitcoin OR ethereum OR memecoin",
          sortBy: "publishedAt",
          language: "en",
          apiKey: config.newsApiKey,
          pageSize: 10,
        },
        timeout: 10000,
      }),
    ]);

    let inserted = 0;
    const articles: { title: string; url: string; cat: string }[] = [];

    if (headlinesResp.status === "fulfilled") {
      for (const a of headlinesResp.value.data?.articles ?? []) {
        if (a.title && a.url) articles.push({ title: a.title, url: a.url, cat: CATEGORY_MAP[category] ?? "world" });
      }
    }
    if (cryptoResp.status === "fulfilled") {
      for (const a of cryptoResp.value.data?.articles ?? []) {
        if (a.title && a.url) articles.push({ title: a.title, url: a.url, cat: "crypto" });
      }
    }

    for (const article of articles) {
      const existing = await db
        .select({ id: schema.newsItems.id })
        .from(schema.newsItems)
        .where(eq(schema.newsItems.url, article.url))
        .limit(1);
      if (existing.length > 0) continue;

      await db.insert(schema.newsItems).values({
        headline: article.title,
        source: "newsapi",
        url: article.url,
        category: article.cat,
      });
      inserted++;
    }

    console.log(`[newsapi] Inserted ${inserted} new items (category: ${category})`);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      console.warn("[newsapi] Rate limited — skipping");
      return;
    }
    console.error("[newsapi] Poll error:", err);
  }
}
