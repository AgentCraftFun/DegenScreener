import { z } from "zod";
import { Personality } from "@degenscreener/shared";
import { tweetQueries } from "@degenscreener/db";
import { callLLM, MODELS } from "./llm-client.js";
import { scoreSentiment } from "../sentiment/scorer.js";
import { publishTweet } from "../events.js";

const TweetSchema = z.object({
  content: z.string().max(280),
  sentiment: z.number().min(-1).max(1),
});

export type TweetTrigger =
  | "LAUNCH"
  | "RUG"
  | "BUY"
  | "SELL"
  | "HOLD"
  | "GOT_RUGGED"
  | "MILESTONE";

export interface TrendingContext {
  topic: string;
  velocity: string;
  sourceCount: number;
  ageMinutes: number;
}

export interface TweetContext {
  personality: Personality;
  trigger: TweetTrigger;
  ticker?: string;
  price?: string;
  marketCap?: string;
  pnlPct?: string;
  trendingContext?: TrendingContext;
}

const PERSONALITY_GUIDE: Record<Personality, string> = {
  [Personality.ANALYTICAL]:
    "Data-driven. Reference price and market cap. Measured tone. Use specifics.",
  [Personality.HYPE_BEAST]:
    "ALL CAPS energy. 'NEXT 100X', 'APING NOW', lots of exclamation marks. Maximum hype.",
  [Personality.TROLL]:
    "Mocking, sarcastic. 'lmao who's still holding', 'ngmi'. Poke fun.",
  [Personality.DOOMER]:
    "Pessimistic. Warnings. 'this is going to rug'. Everything is dead.",
};

export async function generateTweet(
  agentId: string,
  ctx: TweetContext,
  opts: { tokenId?: string | null } = {},
): Promise<{ tweetId: string; content: string; sentiment: number } | null> {
  const trendNote = ctx.trendingContext
    ? `\n\nIMPORTANT: This token is based on a REAL trending event. Reference the actual news in your tweet. Be specific about what's happening in the real world.
Examples of good news-aware tweets:
- "Just launched $CEASEFIRE — US and Iran just announced a two-week ceasefire. This is going to pump HARD"
- "$CEASEFIRE up 400% since launch. News still accelerating — 200+ articles in the last hour. Diamond handing this."
- "Iran ceasefire story cooling off — $CEASEFIRE volume dropping. Taking profits here."
- "lmao who's buying $ELONDOGE? Elon tweets about Doge every week, this is a trap"`
    : "";

  const system = `You are a crypto Twitter degen with this personality: ${ctx.personality}.
${PERSONALITY_GUIDE[ctx.personality]}
Write ONE tweet in character, max 280 chars. Reference the token ticker with $. Be entertaining.${trendNote}
Respond with JSON: { "content": "...", "sentiment": -1 to 1 }`;

  const trendInfo = ctx.trendingContext
    ? `Real-world event: "${ctx.trendingContext.topic}" (velocity: ${ctx.trendingContext.velocity}, ${ctx.trendingContext.sourceCount} sources, ${ctx.trendingContext.ageMinutes}min old)\n`
    : "";

  const user = `Trigger: ${ctx.trigger}
${ctx.ticker ? `Token: ${ctx.ticker}` : ""}
${ctx.price ? `Price: ${ctx.price}` : ""}
${ctx.marketCap ? `Market cap: ${ctx.marketCap}` : ""}
${ctx.pnlPct ? `My P&L: ${ctx.pnlPct}%` : ""}
${trendInfo}`;

  const res = await callLLM({
    systemPrompt: system,
    userPrompt: user,
    responseSchema: TweetSchema,
    model: MODELS.creative,
    maxTokens: 400,
  });

  if (!res) return null;

  // Use LLM sentiment, but fallback/verify with keyword scorer
  const keywordScore = scoreSentiment(res.parsed.content);
  const sentiment = Number.isFinite(res.parsed.sentiment)
    ? res.parsed.sentiment
    : keywordScore;

  const tweet = await tweetQueries.insertTweet({
    agentId,
    content: res.parsed.content,
    tokenId: opts.tokenId ?? null,
    sentimentScore: sentiment.toFixed(2),
  });

  await publishTweet({
    tweetId: tweet.id,
    agentId,
    content: res.parsed.content,
    tokenId: opts.tokenId ?? null,
    sentiment: sentiment.toFixed(2),
  });

  return {
    tweetId: tweet.id,
    content: res.parsed.content,
    sentiment,
  };
}
