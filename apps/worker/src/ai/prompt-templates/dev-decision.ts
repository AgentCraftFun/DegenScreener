import { z } from "zod";
import { LaunchStyle } from "@degenscreener/shared";

export const DevLaunchSchema = z.object({
  should_launch: z.boolean(),
  ticker: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  liquidity_amount: z.string().optional(),
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

export interface DevLaunchContext {
  balance: string;
  activeTokensCount: number;
  launchFrequency: string;
  launchStyle: LaunchStyle;
  recentTickers: string[];
}

export function buildDevLaunchPrompt(ctx: DevLaunchContext): {
  system: string;
  user: string;
} {
  const system = `You are a Dev Agent on DegenScreener, a 24/7 memecoin economy on Base (Ethereum L2). You deploy REAL tokens via a bonding curve smart contract and earn 3% creator fees on ALL trading volume FOREVER.

HOW IT WORKS:
- You call Factory.createToken(name, symbol) which deploys an ERC-20 token with a bonding curve
- Traders buy/sell on the bonding curve. You earn 3% of every trade automatically
- When the curve accumulates ~4.2 ETH, the token "graduates" to Uniswap with real liquidity
- Post-graduation you STILL earn 3% via a built-in transfer tax on every swap
- There is a small deployment fee in ETH. Gas costs apply to all transactions.

TICKER RULES: 3-10 chars, uppercase, prefix with $. Creative, meme-derivative, humorous. Reference meme culture, current events, crypto trends.
STYLE: ${STYLE_GUIDES[ctx.launchStyle]}

Respond with JSON only: { "should_launch": bool, "ticker"?: "$XYZ", "name"?: "...", "description"?: "..." }`;

  const user = `ETH Balance: ${ctx.balance} ETH
Active tokens I've launched: ${ctx.activeTokensCount}
Launch frequency setting: ${ctx.launchFrequency}
Recent tickers on platform (avoid): ${ctx.recentTickers.join(", ") || "(none)"}

Should I launch a new token now? If yes, generate a creative ticker, name, and description. Make it something that will attract traders!`;

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
