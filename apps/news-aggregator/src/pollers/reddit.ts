import axios from "axios";
import { config } from "../config.js";
import { db, schema } from "@degenscreener/db";
import { eq } from "drizzle-orm";

const SUBREDDITS = [
  { name: "all", limit: 20, category: "auto" },
  { name: "cryptocurrency", limit: 10, category: "crypto" },
  { name: "wallstreetbets", limit: 10, category: "crypto" },
  { name: "politics", limit: 10, category: "politics" },
];

const SUBREDDIT_CATEGORY_MAP: Record<string, string> = {
  cryptocurrency: "crypto",
  bitcoin: "crypto",
  ethereum: "crypto",
  wallstreetbets: "crypto",
  politics: "politics",
  worldnews: "politics",
  news: "world",
  technology: "tech",
  science: "tech",
  entertainment: "pop_culture",
  movies: "pop_culture",
  gaming: "pop_culture",
  sports: "sports",
  nba: "sports",
  nfl: "sports",
  soccer: "sports",
};

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  if (!config.redditClientId || !config.redditClientSecret) return null;

  try {
    const resp = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        auth: { username: config.redditClientId, password: config.redditClientSecret },
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "DegenScreener/1.0" },
        timeout: 10000,
      },
    );
    accessToken = resp.data.access_token;
    tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
    return accessToken;
  } catch (err) {
    console.error("[reddit] OAuth error:", err);
    return null;
  }
}

export async function pollReddit() {
  const token = await getAccessToken();
  if (!token) return;

  try {
    let inserted = 0;
    for (const sub of SUBREDDITS) {
      const resp = await axios.get(`https://oauth.reddit.com/r/${sub.name}/hot`, {
        params: { limit: sub.limit },
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "DegenScreener/1.0" },
        timeout: 10000,
      });

      const posts = resp.data?.data?.children ?? [];
      for (const post of posts) {
        const d = post.data;
        if (!d?.title || d.stickied) continue;

        const permalink = `https://reddit.com${d.permalink}`;
        const existing = await db
          .select({ id: schema.newsItems.id })
          .from(schema.newsItems)
          .where(eq(schema.newsItems.url, permalink))
          .limit(1);
        if (existing.length > 0) continue;

        // Determine category
        let category = sub.category;
        if (category === "auto") {
          const subreddit = (d.subreddit ?? "").toLowerCase();
          category = SUBREDDIT_CATEGORY_MAP[subreddit] ?? "world";
        }

        // Sentiment from upvote ratio
        const sentiment = ((d.upvote_ratio ?? 0.5) * 2 - 1).toFixed(2);

        await db.insert(schema.newsItems).values({
          headline: d.title,
          source: `reddit:r/${d.subreddit ?? sub.name}`,
          url: permalink,
          category,
          sentiment,
        });
        inserted++;
      }
    }

    console.log(`[reddit] Inserted ${inserted} new items`);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      console.warn("[reddit] Rate limited — skipping");
      return;
    }
    console.error("[reddit] Poll error:", err);
  }
}
