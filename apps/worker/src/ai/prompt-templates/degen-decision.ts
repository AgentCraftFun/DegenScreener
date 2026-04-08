import { z } from "zod";
import { RiskProfile } from "@degenscreener/shared";

export const DegenDecisionSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD"]),
  token_ticker: z.string().optional(),
  amount: z.string().optional(),
  reasoning: z.string().max(500),
});
export type DegenDecisionResponse = z.infer<typeof DegenDecisionSchema>;

const PROFILE_RULES: Record<RiskProfile, string> = {
  [RiskProfile.CONSERVATIVE]:
    "Position size: 1-5% of ETH balance. Sell 50% at 2x, rest at 3x. Stop-loss at -30%.",
  [RiskProfile.MODERATE]:
    "Position size: 5-15% of ETH balance. Sell initials at 2x, hold rest. Stop-loss at -50%.",
  [RiskProfile.AGGRESSIVE]:
    "Position size: 15-30% of ETH balance. Target 5-10x, scale out slowly. Stop-loss at -70%.",
  [RiskProfile.FULL_DEGEN]:
    "Position size: 30-40% of ETH balance. Diamond hands or bust. No stop-loss.",
};

export function buildDegenSystemPrompt(
  profile: RiskProfile,
  opts: { contrarian?: boolean } = {},
): string {
  const base = `You are trading REAL tokens with REAL ETH on Base (Ethereum L2). Tokens on DegenScreener are launched by AI Dev Agents based on real-world trending news. Your edge: understand whether a token's underlying news story is still trending or fading.

TRADING MECHANICS:
- Tokens start on a bonding curve. You buy with ETH, the price rises along the curve.
- When ~4.2 ETH accumulates, the token "graduates" to Uniswap with real liquidity.
- All trades have a 4% fee (3% to creator, 1% to platform). Factor this into your P&L calculations.
- Each trade costs ~0.001 ETH in gas. Don't make trades smaller than 0.01 ETH.
- Pre-bond tokens: buy/sell on the bonding curve
- Graduated tokens: trade on Uniswap (higher liquidity, different dynamics)
- Tokens close to graduation (>80% progress) may see a push as traders try to be the ones to graduate it

NEWS-DRIVEN EDGE:
- Tokens backed by ACCELERATING news → higher conviction buy (the story is growing, more people will find and trade this token)
- Tokens whose underlying story is 6+ hours old and DECLINING → consider selling (the hype is over)
- Breaking news just dropped, no token yet → watch for new launch and consider aping early
- Token with no real news backing → likely low-quality, avoid or small position only
- Source count matters: 20+ sources = mainstream attention = more potential traders

Your risk profile is: ${profile}.
${PROFILE_RULES[profile]}

RULES:
- Consider actual token price and market cap, not just sentiment. High sentiment alone is NOT a buy signal if the price has already 10x'd.
- Occasionally (~15% of the time), take the contrarian position.
- BUY amount is in ETH (e.g., "0.01" = 0.01 ETH). SELL amount is a percentage of your holdings (e.g., "50" = sell 50%).
- Keep enough ETH for gas (~0.001 ETH minimum reserve).
- Respond with JSON only: { "action": "BUY"|"SELL"|"HOLD", "token_ticker"?: "$XYZ", "amount"?: "0.01", "reasoning": "..." }`;

  if (opts.contrarian) {
    return (
      base +
      `\n\nYou are a CONTRARIAN trader. When everyone is bullish, you look for the exit. When everyone is panicking, you look for the entry.`
    );
  }
  return base;
}

export interface TopicMomentum {
  topic: string;
  velocity: string;
  sourceCount: number;
  ageMinutes: number;
}

export interface TokenTopicContext {
  ticker: string;
  topic: string;
  velocity: string;
  sourceCountTrend: string;
}

export interface DegenDecisionContext {
  balance: string;
  ethBalance?: string;
  holdings: {
    ticker: string;
    quantity: string;
    entryPrice: string;
    currentPrice: string;
    pnlPct: string;
    phase?: string;
  }[];
  activeTokens: {
    ticker: string;
    price: string;
    marketCap: string;
    volume24h: string;
    change24hPct: string;
    phase?: string;
  }[];
  newPairs: { ticker: string; ageTicks: number; price: string }[];
  recentTweets: { ticker: string | null; content: string; sentiment: string }[];
  recentTrades: { type: string; ticker: string; amount: string }[];
  trendingTopics?: { topic: string; category: string; tokens: string[]; velocity: string; sourceCount: number; sentiment?: string }[];
  portfolioTopicMomentum?: TokenTopicContext[];
}

export function buildDegenUserPrompt(ctx: DegenDecisionContext): string {
  const portfolio = ctx.holdings.length
    ? ctx.holdings
        .map(
          (h) =>
            `  ${h.ticker}: qty=${h.quantity} entry=${h.entryPrice} now=${h.currentPrice} pnl=${h.pnlPct}% [${h.phase ?? "PRE_BOND"}]`,
        )
        .join("\n")
    : "  (empty)";

  const market = ctx.activeTokens
    .slice(0, 20)
    .map(
      (t) =>
        `  ${t.ticker}: price=${t.price} mc=${t.marketCap} vol=${t.volume24h} 24h=${t.change24hPct}% [${t.phase ?? "PRE_BOND"}]`,
    )
    .join("\n");

  const newPairs = ctx.newPairs.length
    ? ctx.newPairs
        .map((n) => `  ${n.ticker}: age=${n.ageTicks}t price=${n.price}`)
        .join("\n")
    : "  (none)";

  const tweets = ctx.recentTweets
    .slice(0, 20)
    .map((t) => `  [${t.sentiment}] ${t.ticker ?? "—"}: ${t.content}`)
    .join("\n");

  const trades = ctx.recentTrades
    .slice(0, 10)
    .map((t) => `  ${t.type} ${t.ticker} ${t.amount}`)
    .join("\n");

  let realWorldBlock = "";
  if (ctx.trendingTopics && ctx.trendingTopics.length > 0) {
    realWorldBlock = `\n\nREAL-WORLD CONTEXT — Trending topics and their associated tokens:
${ctx.trendingTopics.map((t) => `  [${t.category}] "${t.topic}" — tokens: ${t.tokens.length > 0 ? t.tokens.join(", ") : "(none yet)"}, velocity: ${t.velocity}, sources: ${t.sourceCount}`).join("\n")}`;
  }

  let momentumBlock = "";
  if (ctx.portfolioTopicMomentum && ctx.portfolioTopicMomentum.length > 0) {
    momentumBlock = `\n\nTopic momentum for tokens in your portfolio:
${ctx.portfolioTopicMomentum.map((t) => `  ${t.ticker}: topic="${t.topic}", velocity: ${t.velocity}, source trend: ${t.sourceCountTrend}`).join("\n")}`;
  }

  return `ETH Balance: ${ctx.ethBalance ?? ctx.balance} ETH

Portfolio:
${portfolio}

Market:
${market}

New pairs:
${newPairs}

Recent tweets:
${tweets}

My recent trades:
${trades}${realWorldBlock}${momentumBlock}`;
}
