import { Decimal } from "decimal.js";
import {
  holdingQueries,
  tokenQueries,
  tweetQueries,
  tradeQueries,
  agentQueries,
  schema,
} from "@degenscreener/db";
import { RiskProfile, Personality } from "@degenscreener/shared";
import {
  buildDegenSystemPrompt,
  buildDegenUserPrompt,
  DegenDecisionSchema,
  type DegenDecisionContext,
  type TokenTopicContext,
} from "../ai/prompt-templates/degen-decision.js";
import type { TrendData } from "../tick.js";
import { callLLM, MODELS } from "../ai/llm-client.js";
import {
  checkFallbackRules,
  type HoldingCtx,
} from "../ai/fallback-rules.js";
import { isWithinBudget, trackUsage, estimateCost } from "../ai/cost-tracker.js";
import { executeIntent, type TradeIntent } from "../tx/intent.js";
import { rand } from "../util/rng.js";
import { generateTweet } from "../ai/tweet-generator.js";
import { getCurveState, getPrice } from "@degenscreener/blockchain";

type Agent = typeof schema.agents.$inferSelect;

function isContrarian(agentId: string): boolean {
  const tail = agentId.replace(/-/g, "").slice(-4);
  const n = parseInt(tail, 16);
  return n % 100 < 12;
}

export interface DegenEvalResult {
  action: "BUY" | "SELL" | "HOLD";
  executed: boolean;
  txPending?: boolean;
  error?: string;
}

export async function evaluateDegenAgent(
  agent: Agent,
  trendingTopics?: TrendData[],
): Promise<DegenEvalResult> {
  // Skip if agent not ready
  const ready = await agentQueries.isAgentReady(agent.id);
  if (!ready) {
    return { action: "HOLD", executed: false };
  }

  // Gas check — minimum ETH for any operation
  const ethBal = parseFloat(agent.ethBalance);
  if (ethBal < 0.0005) {
    return { action: "HOLD", executed: false, error: "Insufficient ETH for gas" };
  }

  const holdings = await holdingQueries.getHoldingsByAgent(agent.id);
  const activeTokens = await tokenQueries.getActiveTokens();

  // Build holding context with on-chain prices where possible
  const holdingCtx: HoldingCtx[] = [];
  for (const h of holdings) {
    const token = await tokenQueries.getTokenById(h.tokenId);
    if (!token) continue;

    let price = new Decimal(0);
    const phase = token.phase ?? "PRE_BOND";

    if (phase === "PRE_BOND" && token.contractAddress) {
      try {
        const onChainPrice = await getPrice(token.contractAddress as `0x${string}`);
        // Price from contract is in wei per token, convert to ETH
        price = new Decimal(onChainPrice.toString()).div(new Decimal("1e18"));
      } catch {
        // Fallback to 0
      }
    }

    holdingCtx.push({
      tokenId: h.tokenId,
      ticker: token.ticker,
      quantity: h.quantity,
      avgEntryPrice: h.avgEntryPrice,
      currentPrice: price.toFixed(18),
      tokenStatus: token.status,
      phase,
    });
  }

  const riskProfile = agent.riskProfile as { profile?: RiskProfile };
  const profile = riskProfile.profile ?? RiskProfile.MODERATE;

  // Fallback rules first
  const fb = checkFallbackRules(
    { id: agent.id, balance: agent.ethBalance, ethBalance: agent.ethBalance, riskProfile },
    holdingCtx,
  );
  if (fb.triggered && fb.action) {
    return executeFallback(agent, fb.action, holdingCtx);
  }

  // Budget check
  const estCost = estimateCost(500, 200, MODELS.decision);
  if (!(await isWithinBudget(agent.id, estCost))) {
    return { action: "HOLD", executed: false };
  }

  // Build context for LLM
  const ctx: DegenDecisionContext = {
    balance: agent.ethBalance,
    ethBalance: agent.ethBalance,
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
        phase: h.phase,
      };
    }),
    activeTokens: await Promise.all(
      activeTokens.slice(0, 20).map(async (t) => {
        let price = new Decimal(0);
        const phase = t.phase ?? "PRE_BOND";
        if (phase === "PRE_BOND" && t.contractAddress) {
          try {
            const p = await getPrice(t.contractAddress as `0x${string}`);
            price = new Decimal(p.toString()).div(new Decimal("1e18"));
          } catch { /* */ }
        }
        const mc = price.mul(t.totalSupply);
        return {
          ticker: t.ticker,
          price: price.toFixed(18),
          marketCap: mc.toFixed(6),
          volume24h: "0",
          change24hPct: "0",
          phase,
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

  // Add trending data if available
  if (trendingTopics && trendingTopics.length > 0) {
    // Build topic-to-tokens mapping
    const topicTokenMap = new Map<string, string[]>();
    for (const t of activeTokens) {
      if (t.topicId) {
        const existing = topicTokenMap.get(t.topicId) ?? [];
        existing.push(t.ticker);
        topicTokenMap.set(t.topicId, existing);
      }
    }

    ctx.trendingTopics = trendingTopics.slice(0, 15).map((t) => ({
      topic: t.topic,
      category: t.category,
      tokens: topicTokenMap.get(t.id) ?? [],
      velocity: t.velocity,
      sourceCount: t.sourceCount,
    }));

    // Build portfolio topic momentum
    const portfolioMomentum: TokenTopicContext[] = [];
    for (const h of holdingCtx) {
      const token = await tokenQueries.getTokenById(h.tokenId);
      if (!token?.topicId) continue;
      const trend = trendingTopics.find((t) => t.id === token.topicId);
      if (!trend) continue;
      portfolioMomentum.push({
        ticker: h.ticker,
        topic: trend.topic,
        velocity: trend.velocity,
        sourceCountTrend: trend.sourceCount > 10 ? "high" : trend.sourceCount > 3 ? "moderate" : "low",
      });
    }
    if (portfolioMomentum.length > 0) {
      ctx.portfolioTopicMomentum = portfolioMomentum;
    }
  }

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
    if (rand() < 0.1) {
      await maybeTweet(agent, "HOLD");
    }
    return { action: "HOLD", executed: false };
  }

  if (dec.action === "BUY" && dec.token_ticker && dec.amount) {
    const token = activeTokens.find((t) => t.ticker === dec.token_ticker);
    if (!token || !token.contractAddress) return { action: "HOLD", executed: false };

    // Claude decides the size — only cap at actual balance (can't spend more than you have)
    const amt = new Decimal(dec.amount);
    const bal = new Decimal(agent.ethBalance);
    const gasReserve = new Decimal("0.001"); // keep enough for gas
    const maxSpend = Decimal.max(bal.sub(gasReserve), 0);
    const finalAmt = Decimal.min(amt, maxSpend);
    if (finalAmt.lte(0)) return { action: "HOLD", executed: false };

    const intent: TradeIntent = {
      agentId: agent.id,
      type: "BUY",
      tokenAddress: token.contractAddress as `0x${string}`,
      ethAmount: BigInt(finalAmt.mul("1e18").toFixed(0)),
    };

    const intentResult = await executeIntent(intent);
    return {
      action: "BUY",
      executed: intentResult.success,
      txPending: intentResult.success,
      error: intentResult.error,
    };
  }

  if (dec.action === "SELL" && dec.token_ticker && dec.amount) {
    const token = activeTokens.find((t) => t.ticker === dec.token_ticker);
    if (!token || !token.contractAddress) return { action: "HOLD", executed: false };
    const holding = holdings.find((h) => h.tokenId === token.id);
    if (!holding) return { action: "HOLD", executed: false };

    const pct = new Decimal(dec.amount).div(100);
    const qty = new Decimal(holding.quantity).mul(pct);
    if (qty.lte(0)) return { action: "HOLD", executed: false };

    const intent: TradeIntent = {
      agentId: agent.id,
      type: "SELL",
      tokenAddress: token.contractAddress as `0x${string}`,
      tokenAmount: BigInt(qty.mul("1e18").toFixed(0)),
    };

    const intentResult = await executeIntent(intent);
    return {
      action: "SELL",
      executed: intentResult.success,
      txPending: intentResult.success,
      error: intentResult.error,
    };
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

  const token = await tokenQueries.getTokenById(action.tokenId);
  if (!token?.contractAddress) return { action: "HOLD", executed: false };

  const qty = new Decimal(h.quantity);
  const sellQty = action.kind === "SELL_ALL" ? qty : qty.mul("0.5");
  if (sellQty.lte(0)) return { action: "HOLD", executed: false };

  const intent: TradeIntent = {
    agentId: agent.id,
    type: "SELL",
    tokenAddress: token.contractAddress as `0x${string}`,
    tokenAmount: BigInt(sellQty.mul("1e18").toFixed(0)),
  };

  const intentResult = await executeIntent(intent);
  return {
    action: "SELL",
    executed: intentResult.success,
    txPending: intentResult.success,
    error: intentResult.error,
  };
}

async function maybeTweet(
  agent: Agent,
  trigger: "BUY" | "SELL" | "HOLD" | "LAUNCH",
  ticker?: string,
) {
  try {
    await generateTweet(agent.id, {
      personality: agent.personality as Personality,
      trigger,
      ticker,
    });
  } catch (e) {
    void e;
  }
}
