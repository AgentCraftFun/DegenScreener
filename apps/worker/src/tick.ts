import type { Redis } from "ioredis";
import {
  agentQueries,
  tokenQueries,
  holdingQueries,
  notificationQueries,
  walletQueries,
} from "@degenscreener/db";
import {
  getAgentsForTick,
  scheduleNextEval,
  circuitBreaker,
} from "./agents/scheduler.js";
import {
  getScriptedDevDecision,
  getScriptedDegenDecision,
} from "./agents/scripted-decisions.js";
import { launchToken } from "./agents/launch.js";
import { executeBuyTrade, executeSellTrade } from "./pool/execute-trade.js";
import { AgentType } from "@degenscreener/shared";
import { Decimal } from "decimal.js";
import { evaluateDegenAgent } from "./agents/degen-evaluator.js";
import { evaluateDevAgent } from "./agents/dev-evaluator.js";
import { sweepPendingTransactions } from "./tx/confirmation-handler.js";
import {
  publishTradeEvent,
  publishPriceUpdate,
  publishTokenLaunch,
  publishNotification,
} from "./events.js";
import { poolQueries } from "@degenscreener/db";
import { userQueries } from "@degenscreener/db";

export interface TrendData {
  id: string;
  topic: string;
  category: string;
  memabilityScore: string;
  velocity: string;
  sourceCount: number;
  ageMinutes: number;
  alreadyLaunched: boolean;
  launchedTokenId?: string | null;
  suggestedTickers: string[];
}

export interface TickContext {
  useAi: boolean;
  redis?: Redis;
  /** If true, use V1 scripted simulation mode (no on-chain txs). Used for fast-forward. */
  simulationMode?: boolean;
  /** Trending topics from news aggregator Redis store */
  trendingTopics?: TrendData[];
  /** Breaking news (< 30 min, high memability) */
  breakingNews?: TrendData[];
}

export interface TickStats {
  trades: number;
  launches: number;
  rugs: number;
  tweets: number;
  broke: number;
  txSubmitted: number;
  txConfirmed: number;
}

// Min ETH to consider an agent broke (below gas threshold)
const BROKE_ETH_THRESHOLD = 0.0001;

export async function runTick(
  tick: number,
  ctx: TickContext,
): Promise<TickStats> {
  const stats: TickStats = {
    trades: 0,
    launches: 0,
    rugs: 0,
    tweets: 0,
    broke: 0,
    txSubmitted: 0,
    txConfirmed: 0,
  };

  // --- Step 1: Sweep pending transaction confirmations ---
  if (!ctx.simulationMode) {
    try {
      await sweepPendingTransactions();
    } catch (e) {
      console.error("[tick] sweep confirmations error:", e);
    }
  }

  // --- Step 2: Periodically refresh ETH balances (every 10 ticks) ---
  if (!ctx.simulationMode && tick % 10 === 0) {
    try {
      await refreshAllAgentBalances();
    } catch (e) {
      console.error("[tick] balance refresh error:", e);
    }
  }

  // --- Step 3: Evaluate scheduled agents ---
  const agents = await getAgentsForTick(tick);

  for (const agent of agents) {
    if (!circuitBreaker.allow(agent.id)) continue;

    try {
      if (ctx.useAi && !ctx.simulationMode) {
        // V2: On-chain mode — AI decides, intent system submits txs
        if (agent.type === AgentType.DEV) {
          const r = await evaluateDevAgent(agent, ctx.trendingTopics, ctx.breakingNews);
          if (r.launched) stats.launches++;
          if (r.txPending) stats.txSubmitted++;
        } else {
          const r = await evaluateDegenAgent(agent, ctx.trendingTopics);
          if (r.executed && (r.action === "BUY" || r.action === "SELL")) {
            stats.trades++;
          }
          if (r.txPending) stats.txSubmitted++;
        }
      } else {
        // V1: Scripted simulation mode (fast-forward or non-AI)
        const activeTokens = await tokenQueries.getActiveTokens();

        if (agent.type === AgentType.DEV) {
          const dec = getScriptedDevDecision(agent, activeTokens, tick);
          if (dec.kind === "LAUNCH") {
            const launched = await launchToken(
              agent.id,
              dec.ticker,
              dec.name,
              dec.initialLiquidity,
              "1000000000",
            );
            if (launched) {
              stats.launches++;
              const pool = await poolQueries.getPoolByTokenId(launched.tokenId);
              const price =
                pool && new Decimal(pool.tokenReserve).gt(0)
                  ? new Decimal(pool.dscreenReserve).div(pool.tokenReserve).toFixed(18)
                  : "0";
              await publishTokenLaunch({
                tokenId: launched.tokenId,
                ticker: launched.ticker,
                name: dec.name,
                creatorAgentId: agent.id,
                initialPrice: price,
              });
            }
          }
          // V2: Rug removed from scripted mode too
        } else {
          const holdings = await holdingQueries.getHoldingsByAgent(agent.id);
          const dec = getScriptedDegenDecision(agent, activeTokens, holdings);
          if (dec.kind === "BUY") {
            const res = await executeBuyTrade(
              agent.id,
              dec.tokenId,
              dec.dscreenAmount,
            );
            if (res) {
              stats.trades++;
              await publishTradeEvent({
                tradeId: res.tradeId,
                agentId: agent.id,
                tokenId: dec.tokenId,
                type: "BUY",
                dscreenAmount: dec.dscreenAmount,
                tokenAmount: res.tokensOut,
                priceAfter: res.priceAfter,
              });
              await publishPriceUpdate({
                tokenId: dec.tokenId,
                price: res.priceAfter,
                volumeDelta: dec.dscreenAmount,
              });
            }
          } else if (dec.kind === "SELL") {
            const res = await executeSellTrade(
              agent.id,
              dec.tokenId,
              dec.tokenAmount,
            );
            if (res) {
              stats.trades++;
              await publishTradeEvent({
                tradeId: res.tradeId,
                agentId: agent.id,
                tokenId: dec.tokenId,
                type: "SELL",
                dscreenAmount: res.dscreenOut,
                tokenAmount: dec.tokenAmount,
                priceAfter: res.priceAfter,
              });
              await publishPriceUpdate({
                tokenId: dec.tokenId,
                price: res.priceAfter,
                volumeDelta: res.dscreenOut,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`[tick] agent ${agent.handle} error:`, e);
    }

    // --- Step 4: Check BROKE transition ---
    const fresh = await agentQueries.getAgentById(agent.id);
    if (fresh && fresh.status === "ACTIVE") {
      const isBroke = ctx.simulationMode
        ? new Decimal(fresh.balance).lt("0.01")
        : parseFloat(fresh.ethBalance) < BROKE_ETH_THRESHOLD;

      if (isBroke) {
        const h = await holdingQueries.getHoldingsByAgent(agent.id);
        const hasValue = h.some((x) => new Decimal(x.quantity).gt(0));
        if (!hasValue) {
          await agentQueries.updateAgentStatus(agent.id, "BROKE");
          const notif = await notificationQueries.createNotification({
            userId: fresh.ownerId,
            type: "AGENT_BROKE",
            title: "Agent went broke",
            message: `Agent ${fresh.handle} ran out of ETH and is paused.`,
          });
          stats.broke++;
          const owner = await userQueries.getUserById(fresh.ownerId);
          if (owner) {
            await publishNotification(owner.walletAddress, {
              notificationId: notif.id,
              type: "AGENT_BROKE",
              title: notif.title,
              message: notif.message,
            });
          }
        }
      }
    }

    await scheduleNextEval(agent.id, tick);
  }

  if (ctx.redis) {
    await ctx.redis.publish(
      "global",
      JSON.stringify({ type: "tick", tick, stats }),
    );
  }

  return stats;
}

/**
 * Refresh ETH balances for all active agents from chain.
 */
async function refreshAllAgentBalances() {
  try {
    const { refreshAllBalances } = await import("@degenscreener/blockchain");
    const getAllWallets = async () => {
      const wallets = await walletQueries.getAllWallets();
      return wallets;
    };
    await refreshAllBalances(getAllWallets);
  } catch (e) {
    console.error("[tick] refreshAllAgentBalances error:", e);
  }
}
