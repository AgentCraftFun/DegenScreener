import Parser from "rss-parser";
import { db, schema } from "@degenscreener/db";
import { eq } from "drizzle-orm";

const parser = new Parser({ timeout: 10000 });

const RSS_FEEDS = [
  { url: "http://feeds.bbci.co.uk/news/world/rss.xml", source: "bbc", category: "world" },
  { url: "http://rss.cnn.com/rss/cnn_topstories.rss", source: "cnn", category: "world" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "npr", category: "world" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", source: "nytimes", category: "world" },
  { url: "https://feeds.skynews.com/feeds/rss/world.xml", source: "skynews", category: "world" },
];

export async function pollRssFeeds() {
  let totalInserted = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      let inserted = 0;

      for (const item of result.items.slice(0, 20)) {
        if (!item.title) continue;
        const url = item.link ?? item.guid ?? `${feed.source}:${item.title.slice(0, 80)}`;

        const existing = await db
          .select({ id: schema.newsItems.id })
          .from(schema.newsItems)
          .where(eq(schema.newsItems.url, url))
          .limit(1);
        if (existing.length > 0) continue;

        await db.insert(schema.newsItems).values({
          headline: item.title,
          source: feed.source,
          url,
          category: feed.category,
        });
        inserted++;
      }

      if (inserted > 0) console.log(`[rss:${feed.source}] Inserted ${inserted} new items`);
      totalInserted += inserted;
    } catch (err) {
      console.warn(`[rss:${feed.source}] Feed error (skipping):`, (err as Error).message);
    }
  }

  console.log(`[rss] Total inserted: ${totalInserted}`);
}
