import { z } from "zod";
import { LaunchStyle } from "@degenscreener/shared";

export const DevLaunchSchema = z.object({
  should_launch: z.boolean(),
  ticker: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  based_on_topic_id: z.string().optional(),
  reasoning: z.string().optional(),
});
export type DevLaunchResponse = z.infer<typeof DevLaunchSchema>;

export const DevRugSchema = z.object({
  token_ticker: z.string(),
  reasoning: z.string().max(300),
});
export type DevRugResponse = z.infer<typeof DevRugSchema>;

const STYLE_GUIDES: Record<LaunchStyle, string> = {
  [LaunchStyle.MILD]: "Mild and relatable meme references. Safe humor.",
  [LaunchStyle.SPICY]:
    "Edgy, crypto-native meme references. Playful irreverence.",
  [LaunchStyle.DEGEN]:
    "Unhinged, maximally degen. Reference chaos, rugs, rocket ships, apes, lambos.",
};

export interface TrendingTopic {
  id: string;
  topic: string;
  category: string;
  memabilityScore: string;
  velocity: string;
  sourceCount: number;
  ageMinutes: number;
  alreadyLaunched: boolean;
  suggestedTickers: string[];
}

export interface DevLaunchContext {
  balance: string;
  activeTokensCount: number;
  launchFrequency: string;
  launchStyle: LaunchStyle;
  recentTickers: string[];
  trendingTopics?: TrendingTopic[];
  breakingNews?: TrendingTopic[];
}

export function buildDevLaunchPrompt(ctx: DevLaunchContext): {
  system: string;
  user: string;
} {
  const system = `You are a Dev Agent on DegenScreener, a REAL token launchpad on Base (Ethereum L2). You launch REAL ERC-20 tokens based on trending news and cultural moments. Your goal: be FIRST to launch a token on a breaking story before other Devs do.

HOW IT WORKS:
- You call Factory.createToken(name, symbol) which deploys an ERC-20 token with a bonding curve
- Traders buy/sell on the bonding curve. You earn 3% of every trade automatically — this is your primary income
- When the curve accumulates ~4.2 ETH, the token "graduates" to Uniswap with real liquidity
- Post-graduation you STILL earn 3% via a built-in transfer tax on every swap FOREVER
- 1% goes to the platform. Total fee: 4% on all trades.
- Deployment costs ~0.01 ETH + gas

STRATEGY:
- Prioritize BREAKING NEWS with high memability that hasn't been launched yet — first-mover wins
- Speed matters: the first token on a trending topic gets the most volume = most fees for you
- Avoid stale topics (> 3 hours old with declining velocity) — the opportunity has passed
- If a topic already has a token (already_launched = true), either skip or create a differentiated angle
- The ticker should be culturally relevant, funny, and catchy — not random
- Your 3% creator fee means volume is EVERYTHING. Pick topics that will generate excitement

TICKER RULES: 3-10 chars, uppercase, prefix with $. Creative, meme-derivative, humorous.
STYLE: ${STYLE_GUIDES[ctx.launchStyle]}

Respond with JSON only: { "should_launch": bool, "ticker"?: "$XYZ", "name"?: "...", "description"?: "...", "based_on_topic_id"?: "uuid", "reasoning": "..." }`;

  let trendingBlock = "";
  if (ctx.trendingTopics && ctx.trendingTopics.length > 0) {
    trendingBlock = `\n\nTRENDING TOPICS (ranked by memability x velocity):
${ctx.trendingTopics.map((t, i) => `${i + 1}. [${t.category}] "${t.topic}" — memability: ${t.memabilityScore}/10, velocity: ${t.velocity}, age: ${t.ageMinutes}min, sources: ${t.sourceCount}${t.alreadyLaunched ? " [ALREADY LAUNCHED]" : ""}${t.suggestedTickers.length > 0 ? `, suggested: ${t.suggestedTickers.join(", ")}` : ""}`).join("\n")}`;
  }

  let breakingBlock = "";
  if (ctx.breakingNews && ctx.breakingNews.length > 0) {
    breakingBlock = `\n\nBREAKING NEWS (< 30 min old, HIGH PRIORITY — act fast!):
${ctx.breakingNews.map((t, i) => `${i + 1}. "${t.topic}" — memability: ${t.memabilityScore}/10, age: ${t.ageMinutes}min${t.alreadyLaunched ? " [ALREADY LAUNCHED]" : " [NO TOKEN YET — opportunity!]"}`).join("\n")}`;
  }

  const fallbackNote = (!ctx.trendingTopics || ctx.trendingTopics.length === 0)
    ? "\n\nNo trending data available. Generate a creative memecoin based on current crypto/internet culture."
    : "";

  const user = `ETH Balance: ${ctx.balance} ETH
Active tokens I've launched: ${ctx.activeTokensCount}
Launch frequency setting: ${ctx.launchFrequency}
Recent tickers on platform (avoid): ${ctx.recentTickers.join(", ") || "(none)"}${trendingBlock}${breakingBlock}${fallbackNote}

Should I launch a new token now? If yes, pick the best trending topic and generate a killer ticker that will attract volume!`;

  return { system, user };
}

export interface DevRugContext {
  handle: string;
  tokens: { ticker: string; ageTicks: number; poolDscreen: string }[];
}

export function buildDevRugPrompt(ctx: DevRugContext): {
  system: string;
  user: string;
} {
  const system = `You are a Dev Agent deciding which of your tokens to rug (pull liquidity). Pick one strategically. Respond with JSON: { "token_ticker": "$X", "reasoning": "..." }`;
  const user = `Handle: ${ctx.handle}
My tokens:
${ctx.tokens.map((t) => `  ${t.ticker}: age=${t.ageTicks}t liquidity=${t.poolDscreen}`).join("\n")}`;
  return { system, user };
}
