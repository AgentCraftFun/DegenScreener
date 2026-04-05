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
    "Position size: 1-5% of balance. Sell 50% at 2x, rest at 3x. Stop-loss at -30%.",
  [RiskProfile.MODERATE]:
    "Position size: 5-15% of balance. Sell initials at 2x, hold rest. Stop-loss at -50%.",
  [RiskProfile.AGGRESSIVE]:
    "Position size: 15-30% of balance. Target 5-10x, scale out slowly. Stop-loss at -70%.",
  [RiskProfile.FULL_DEGEN]:
    "Position size: 30-50%+ of balance. Diamond hands or bust. No stop-loss.",
};

export function buildDegenSystemPrompt(
  profile: RiskProfile,
  opts: { contrarian?: boolean } = {},
): string {
  const base = `You are an autonomous memecoin degen trader on DegenScreener. Your risk profile is: ${profile}.
${PROFILE_RULES[profile]}

RULES:
- You MUST consider the actual token price and market cap, not just what other agents are saying. High sentiment alone is NOT a buy signal if the price has already 10x'd.
- Occasionally (roughly 15% of the time), take the contrarian position. If everyone is bullish, consider that the top might be in. If everyone is panicking, look for entries.
- Amounts in DSCREEN for BUY, as a percentage (e.g. "50") for SELL.
- Respond with JSON only: { "action": "BUY"|"SELL"|"HOLD", "token_ticker"?: "$XYZ", "amount"?: "10", "reasoning": "..." }`;

  if (opts.contrarian) {
    return (
      base +
      `\n\nYou are a CONTRARIAN trader. When everyone is bullish, you look for the exit. When everyone is panicking, you look for the entry.`
    );
  }
  return base;
}

export interface DegenDecisionContext {
  balance: string;
  holdings: {
    ticker: string;
    quantity: string;
    entryPrice: string;
    currentPrice: string;
    pnlPct: string;
  }[];
  activeTokens: {
    ticker: string;
    price: string;
    marketCap: string;
    volume24h: string;
    change24hPct: string;
  }[];
  newPairs: { ticker: string; ageTicks: number; price: string }[];
  recentTweets: { ticker: string | null; content: string; sentiment: string }[];
  recentTrades: { type: string; ticker: string; amount: string }[];
}

export function buildDegenUserPrompt(ctx: DegenDecisionContext): string {
  const portfolio = ctx.holdings.length
    ? ctx.holdings
        .map(
          (h) =>
            `  ${h.ticker}: qty=${h.quantity} entry=${h.entryPrice} now=${h.currentPrice} pnl=${h.pnlPct}%`,
        )
        .join("\n")
    : "  (empty)";

  const market = ctx.activeTokens
    .slice(0, 20)
    .map(
      (t) =>
        `  ${t.ticker}: price=${t.price} mc=${t.marketCap} vol=${t.volume24h} 24h=${t.change24hPct}%`,
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

  return `Balance: ${ctx.balance} DSCREEN

Portfolio:
${portfolio}

Market:
${market}

New pairs:
${newPairs}

Recent tweets:
${tweets}

My recent trades:
${trades}`;
}
