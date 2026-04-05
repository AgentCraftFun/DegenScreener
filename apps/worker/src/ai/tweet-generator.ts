import { z } from "zod";
import { Personality } from "@degenscreener/shared";
import { tweetQueries } from "@degenscreener/db";
import { callLLM, MODELS } from "./llm-client.js";
import { scoreSentiment } from "../sentiment/scorer.js";

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

export interface TweetContext {
  personality: Personality;
  trigger: TweetTrigger;
  ticker?: string;
  price?: string;
  marketCap?: string;
  pnlPct?: string;
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
  const system = `You are a crypto Twitter degen with this personality: ${ctx.personality}.
${PERSONALITY_GUIDE[ctx.personality]}
Write ONE tweet in character, max 280 chars. Reference the token ticker with $. Be entertaining.
Respond with JSON: { "content": "...", "sentiment": -1 to 1 }`;

  const user = `Trigger: ${ctx.trigger}
${ctx.ticker ? `Token: ${ctx.ticker}` : ""}
${ctx.price ? `Price: ${ctx.price}` : ""}
${ctx.marketCap ? `Market cap: ${ctx.marketCap}` : ""}
${ctx.pnlPct ? `My P&L: ${ctx.pnlPct}%` : ""}`;

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

  return {
    tweetId: tweet.id,
    content: res.parsed.content,
    sentiment,
  };
}
