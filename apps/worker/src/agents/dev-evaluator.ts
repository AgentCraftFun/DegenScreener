import { tokenQueries, agentQueries, trendingQueries, schema } from "@degenscreener/db";
import { LaunchStyle, LaunchFrequency } from "@degenscreener/shared";
import {
  buildDevLaunchPrompt,
  DevLaunchSchema,
  type TrendingTopic,
} from "../ai/prompt-templates/dev-decision.js";
import { callLLM, MODELS } from "../ai/llm-client.js";
import { trackUsage } from "../ai/cost-tracker.js";
import { executeIntent, type TradeIntent } from "../tx/intent.js";
import { rand } from "../util/rng.js";
import type { TrendData } from "../tick.js";

type Agent = typeof schema.agents.$inferSelect;

export interface DevEvalResult {
  launched: boolean;
  txPending: boolean;
  error?: string;
}

const FREQ_TO_PROB: Record<LaunchFrequency, number> = {
  [LaunchFrequency.SLOW]: 0.05,
  [LaunchFrequency.MEDIUM]: 0.15,
  [LaunchFrequency.FAST]: 0.35,
};

export async function evaluateDevAgent(
  agent: Agent,
  trendingTopics?: TrendData[],
  breakingNews?: TrendData[],
): Promise<DevEvalResult> {
  const result: DevEvalResult = { launched: false, txPending: false };
  const rp = agent.riskProfile as {
    launchStyle?: LaunchStyle;
    launchFrequency?: LaunchFrequency;
  };

  // Skip if agent not ready (TX_PENDING or COOLDOWN)
  const ready = await agentQueries.isAgentReady(agent.id);
  if (!ready) {
    return result;
  }

  // Check ETH balance — need enough for deploy fee + gas
  const ethBal = parseFloat(agent.ethBalance);
  if (ethBal < 0.001) {
    // Not enough ETH — can't deploy
    return result;
  }

  const activeTokens = await tokenQueries.getActiveTokens();
  const mine = activeTokens.filter((t) => t.creatorAgentId === agent.id);

  // V2: Rug pull removed — bonding curve holds liquidity, not the Dev Agent.
  // Dev Agents earn 3% fees forever instead.

  // Launch decision
  const freq = rp.launchFrequency ?? LaunchFrequency.MEDIUM;
  const launchProb = FREQ_TO_PROB[freq];
  if (mine.length < 3 && ethBal > 0.001 && rand() < launchProb) {
    const recentTickers = activeTokens.slice(0, 10).map((t) => t.ticker);

    // Convert TrendData to TrendingTopic for prompt
    const promptTrends: TrendingTopic[] | undefined = trendingTopics?.map((t) => ({
      id: t.id,
      topic: t.topic,
      category: t.category,
      memabilityScore: t.memabilityScore,
      velocity: t.velocity,
      sourceCount: t.sourceCount,
      ageMinutes: t.ageMinutes,
      alreadyLaunched: t.alreadyLaunched,
      suggestedTickers: t.suggestedTickers,
    }));
    const promptBreaking: TrendingTopic[] | undefined = breakingNews?.map((t) => ({
      id: t.id,
      topic: t.topic,
      category: t.category,
      memabilityScore: t.memabilityScore,
      velocity: t.velocity,
      sourceCount: t.sourceCount,
      ageMinutes: t.ageMinutes,
      alreadyLaunched: t.alreadyLaunched,
      suggestedTickers: t.suggestedTickers,
    }));

    const { system, user } = buildDevLaunchPrompt({
      balance: agent.ethBalance,
      activeTokensCount: mine.length,
      launchFrequency: freq,
      launchStyle: rp.launchStyle ?? LaunchStyle.SPICY,
      recentTickers,
      trendingTopics: promptTrends,
      breakingNews: promptBreaking,
    });

    const res = await callLLM({
      systemPrompt: system,
      userPrompt: user,
      responseSchema: DevLaunchSchema,
      model: MODELS.creative,
      maxTokens: 400,
    });

    if (res) {
      await trackUsage(
        agent.id,
        res.inputTokens,
        res.outputTokens,
        res.model,
      );
      if (
        res.parsed.should_launch &&
        res.parsed.ticker &&
        res.parsed.name
      ) {
        // Clean ticker: remove $ prefix if present
        const ticker = res.parsed.ticker.replace(/^\$/, "").toUpperCase();

        // Submit CREATE_TOKEN intent — on-chain tx
        const intent: TradeIntent = {
          agentId: agent.id,
          type: "CREATE_TOKEN",
          params: {
            name: res.parsed.name,
            symbol: ticker,
          },
        };

        const intentResult = await executeIntent(intent);
        if (intentResult.success) {
          result.launched = true;
          result.txPending = true;
          // Mark trending topic as launched (if applicable)
          if (res.parsed.based_on_topic_id) {
            try {
              await trendingQueries.markTopicLaunched(res.parsed.based_on_topic_id, agent.id);
            } catch { /* topic may not exist */ }
          }
        } else {
          result.error = intentResult.error;
        }
      }
    }
  }

  return result;
}
