import type { Redis } from "ioredis";
import {
  agentQueries,
  tokenQueries,
  holdingQueries,
  notificationQueries,
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
import { rugToken } from "./agents/rug.js";
import { executeBuyTrade, executeSellTrade } from "./pool/execute-trade.js";
import { AgentType } from "@degenscreener/shared";
import { aggregateCandlesForTick } from "./candles/aggregator.js";
import { Decimal } from "decimal.js";
import { evaluateDegenAgent } from "./agents/degen-evaluator.js";
import { evaluateDevAgent } from "./agents/dev-evaluator.js";

export interface TickContext {
  useAi: boolean;
  redis?: Redis;
}

export interface TickStats {
  trades: number;
  launches: number;
  rugs: number;
  tweets: number;
  broke: number;
}

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
  };
  const agents = await getAgentsForTick(tick);
  const touchedTokens = new Set<string>();

  for (const agent of agents) {
    if (!circuitBreaker.allow(agent.id)) continue;

    const activeTokens = await tokenQueries.getActiveTokens();

    try {
      if (ctx.useAi) {
        if (agent.type === AgentType.DEV) {
          const r = await evaluateDevAgent(agent);
          if (r.launched) stats.launches++;
          if (r.rugged) stats.rugs++;
        } else {
          const r = await evaluateDegenAgent(agent);
          if (r.executed && (r.action === "BUY" || r.action === "SELL")) {
            stats.trades++;
          }
        }
      } else if (agent.type === AgentType.DEV) {
        const dec = getScriptedDevDecision(agent, activeTokens, tick);
        if (dec.kind === "LAUNCH") {
          const launched = await launchToken(
            agent.id,
            dec.ticker,
            dec.name,
            dec.initialLiquidity,
            "1000000000",
          );
          if (launched) stats.launches++;
        } else if (dec.kind === "RUG") {
          const ok = await rugToken(agent.id, dec.tokenId);
          if (ok) stats.rugs++;
        }
      } else {
        // DEGEN
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
            touchedTokens.add(dec.tokenId);
          }
        } else if (dec.kind === "SELL") {
          const res = await executeSellTrade(
            agent.id,
            dec.tokenId,
            dec.tokenAmount,
          );
          if (res) {
            stats.trades++;
            touchedTokens.add(dec.tokenId);
          }
        }
      }
    } catch (e) {
      console.error(`[tick] agent ${agent.handle} error:`, e);
    }

    // Check BROKE transition
    const fresh = await agentQueries.getAgentById(agent.id);
    if (fresh && new Decimal(fresh.balance).lt("0.01")) {
      const h = await holdingQueries.getHoldingsByAgent(agent.id);
      const hasValue = h.some((x) => new Decimal(x.quantity).gt(0));
      if (!hasValue && fresh.status === "ACTIVE") {
        await agentQueries.updateAgentStatus(agent.id, "BROKE");
        await notificationQueries.createNotification({
          userId: fresh.ownerId,
          type: "AGENT_BROKE",
          title: "Agent went broke",
          message: `Agent ${fresh.handle} ran out of DSCREEN and is paused.`,
        });
        stats.broke++;
      }
    }

    await scheduleNextEval(agent.id, tick);
  }

  // Candle aggregation for tokens with trades this tick
  for (const tokenId of touchedTokens) {
    await aggregateCandlesForTick(tokenId);
  }

  if (ctx.redis) {
    await ctx.redis.publish(
      "global",
      JSON.stringify({ type: "tick", tick, stats }),
    );
  }

  return stats;
}
