import { Decimal } from "decimal.js";
import {
  holdingQueries,
  tokenQueries,
  tweetQueries,
  poolQueries,
  tradeQueries,
  schema,
} from "@degenscreener/db";
import { RiskProfile, Personality } from "@degenscreener/shared";
import {
  buildDegenSystemPrompt,
  buildDegenUserPrompt,
  DegenDecisionSchema,
  type DegenDecisionContext,
} from "../ai/prompt-templates/degen-decision.js";
import { callLLM, MODELS } from "../ai/llm-client.js";
import {
  checkFallbackRules,
  type HoldingCtx,
} from "../ai/fallback-rules.js";
import { isWithinBudget, trackUsage, estimateCost } from "../ai/cost-tracker.js";
import { executeBuyTrade, executeSellTrade } from "../pool/execute-trade.js";
import { rand } from "../util/rng.js";
import { generateTweet } from "../ai/tweet-generator.js";

type Agent = typeof schema.agents.$inferSelect;

function isContrarian(agentId: string): boolean {
  // Hash last 2 hex chars → mod 100 < 12 (~12% contrarian)
  const tail = agentId.replace(/-/g, "").slice(-4);
  const n = parseInt(tail, 16);
  return n % 100 < 12;
}

export interface DegenEvalResult {
  action: "BUY" | "SELL" | "HOLD";
  executed: boolean;
}

export async function evaluateDegenAgent(
  agent: Agent,
): Promise<DegenEvalResult> {
  const holdings = await holdingQueries.getHoldingsByAgent(agent.id);
  const activeTokens = await tokenQueries.getActiveTokens();

  // Build price map from pools for holdings & active tokens
  const holdingCtx: HoldingCtx[] = [];
  for (const h of holdings) {
    const token = await tokenQueries.getTokenById(h.tokenId);
    if (!token) continue;
    const pool = await poolQueries.getPoolByTokenId(h.tokenId);
    const price =
      pool && new Decimal(pool.tokenReserve).gt(0)
        ? new Decimal(pool.dscreenReserve).div(pool.tokenReserve)
        : new Decimal(0);
    holdingCtx.push({
      tokenId: h.tokenId,
      ticker: token.ticker,
      quantity: h.quantity,
      avgEntryPrice: h.avgEntryPrice,
      currentPrice: price.toFixed(18),
      tokenStatus: token.status,
    });
  }

  const riskProfile = agent.riskProfile as { profile?: RiskProfile };
  const profile = riskProfile.profile ?? RiskProfile.MODERATE;

  // Fallback rules first
  const fb = checkFallbackRules(
    { id: agent.id, balance: agent.balance, riskProfile },
    holdingCtx,
  );
  if (fb.triggered && fb.action) {
    return executeFallback(agent, fb.action, holdingCtx);
  }

  // Budget check (estimate ~500 in + 200 out for typical call)
  const estCost = estimateCost(500, 200, MODELS.decision);
  if (!(await isWithinBudget(agent.id, estCost))) {
    return { action: "HOLD", executed: false };
  }

  // Build context for LLM
  const ctx: DegenDecisionContext = {
    balance: agent.balance,
    holdings: holdingCtx.map((h) => {
      const entry = new Decimal(h.avgEntryPrice);
      const pnlPct = entry.gt(0)
        ? new Decimal(h.currentPrice).sub(entry).div(entry).mul(100).toFixed(1)
        : "0";
      return {
        ticker: h.ticker,
        quantity: h.quantity,
        entryPrice: h.avgEntryPrice,
        currentPrice: h.currentPrice,
        pnlPct,
      };
    }),
    activeTokens: await Promise.all(
      activeTokens.slice(0, 20).map(async (t) => {
        const pool = await poolQueries.getPoolByTokenId(t.id);
        const price =
          pool && new Decimal(pool.tokenReserve).gt(0)
            ? new Decimal(pool.dscreenReserve).div(pool.tokenReserve)
            : new Decimal(0);
        const mc = price.mul(t.totalSupply);
        return {
          ticker: t.ticker,
          price: price.toFixed(18),
          marketCap: mc.toFixed(6),
          volume24h: pool?.totalVolume ?? "0",
          change24hPct: "0",
        };
      }),
    ),
    newPairs: [],
    recentTweets: (await tweetQueries.getGlobalFeed(20)).map((t) => ({
      ticker: null,
      content: t.content,
      sentiment: t.sentimentScore,
    })),
    recentTrades: (await tradeQueries.getTradesByAgent(agent.id, 10)).map(
      (t) => ({
        type: t.type,
        ticker: "",
        amount: t.dscreenAmount,
      }),
    ),
  };

  const contrarian = isContrarian(agent.id);
  const system = buildDegenSystemPrompt(profile, { contrarian });
  const user = buildDegenUserPrompt(ctx);

  const res = await callLLM({
    systemPrompt: system,
    userPrompt: user,
    responseSchema: DegenDecisionSchema,
    model: MODELS.decision,
    maxTokens: 400,
  });

  if (!res) return { action: "HOLD", executed: false };

  await trackUsage(agent.id, res.inputTokens, res.outputTokens, res.model);

  const dec = res.parsed;
  if (dec.action === "HOLD") {
    // Occasional organic commentary
    if (rand() < 0.1) {
      await maybeTweet(agent, "HOLD");
    }
    return { action: "HOLD", executed: false };
  }

  if (dec.action === "BUY" && dec.token_ticker && dec.amount) {
    const token = activeTokens.find((t) => t.ticker === dec.token_ticker);
    if (!token) return { action: "HOLD", executed: false };
    const amt = new Decimal(dec.amount);
    const bal = new Decimal(agent.balance);
    const capped = Decimal.min(amt, bal.mul("0.5"));
    if (capped.lte(0)) return { action: "HOLD", executed: false };
    const buy = await executeBuyTrade(
      agent.id,
      token.id,
      capped.toFixed(18),
    );
    if (buy && rand() < 0.3) {
      await maybeTweet(agent, "BUY", token.ticker);
    }
    return { action: "BUY", executed: !!buy };
  }

  if (dec.action === "SELL" && dec.token_ticker && dec.amount) {
    const token = activeTokens.find((t) => t.ticker === dec.token_ticker);
    if (!token) return { action: "HOLD", executed: false };
    const holding = holdings.find((h) => h.tokenId === token.id);
    if (!holding) return { action: "HOLD", executed: false };
    const pct = new Decimal(dec.amount).div(100);
    const qty = new Decimal(holding.quantity).mul(pct);
    if (qty.lte(0)) return { action: "HOLD", executed: false };
    const sell = await executeSellTrade(
      agent.id,
      token.id,
      qty.toFixed(18),
    );
    if (sell && rand() < 0.3) {
      await maybeTweet(agent, "SELL", token.ticker);
    }
    return { action: "SELL", executed: !!sell };
  }

  return { action: "HOLD", executed: false };
}

async function executeFallback(
  agent: Agent,
  action: NonNullable<ReturnType<typeof checkFallbackRules>["action"]>,
  holdings: HoldingCtx[],
): Promise<DegenEvalResult> {
  if (action.kind === "HOLD") return { action: "HOLD", executed: false };
  const h = holdings.find((x) => x.tokenId === action.tokenId);
  if (!h) return { action: "HOLD", executed: false };
  const qty = new Decimal(h.quantity);
  const sellQty = action.kind === "SELL_ALL" ? qty : qty.mul("0.5");
  if (sellQty.lte(0)) return { action: "HOLD", executed: false };
  const r = await executeSellTrade(agent.id, action.tokenId, sellQty.toFixed(18));
  return { action: "SELL", executed: !!r };
}

async function maybeTweet(
  agent: Agent,
  trigger: "BUY" | "SELL" | "HOLD" | "LAUNCH" | "RUG",
  ticker?: string,
) {
  try {
    await generateTweet(agent.id, {
      personality: agent.personality as Personality,
      trigger,
      ticker,
    });
  } catch (e) {
    // swallow
    void e;
  }
}
