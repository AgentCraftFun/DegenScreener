import { Decimal } from "decimal.js";
import { tokenQueries, poolQueries, schema } from "@degenscreener/db";
import { LaunchStyle, LaunchFrequency } from "@degenscreener/shared";
import {
  buildDevLaunchPrompt,
  DevLaunchSchema,
} from "../ai/prompt-templates/dev-decision.js";
import { callLLM, MODELS } from "../ai/llm-client.js";
import { trackUsage } from "../ai/cost-tracker.js";
import { launchToken } from "./launch.js";
import { rugToken } from "./rug.js";
import { rand } from "../util/rng.js";

type Agent = typeof schema.agents.$inferSelect;

export interface DevEvalResult {
  launched: boolean;
  rugged: boolean;
}

const FREQ_TO_PROB: Record<LaunchFrequency, number> = {
  [LaunchFrequency.SLOW]: 0.05,
  [LaunchFrequency.MEDIUM]: 0.15,
  [LaunchFrequency.FAST]: 0.35,
};

export async function evaluateDevAgent(
  agent: Agent,
): Promise<DevEvalResult> {
  const result: DevEvalResult = { launched: false, rugged: false };
  const rp = agent.riskProfile as {
    launchStyle?: LaunchStyle;
    launchFrequency?: LaunchFrequency;
    rugProbability?: number;
  };
  const bal = new Decimal(agent.balance);

  const activeTokens = await tokenQueries.getActiveTokens();
  const mine = activeTokens.filter((t) => t.creatorAgentId === agent.id);

  // Rug decision
  const rugProb = rp.rugProbability ?? 0;
  if (mine.length > 0 && rand() < rugProb) {
    // Pick oldest (could use LLM, but oldest is reliable)
    const oldest = mine.reduce((a, b) =>
      a.createdAt < b.createdAt ? a : b,
    );
    const ok = await rugToken(agent.id, oldest.id);
    result.rugged = ok;
  }

  // Launch decision
  const freq = rp.launchFrequency ?? LaunchFrequency.MEDIUM;
  const launchProb = FREQ_TO_PROB[freq];
  if (mine.length < 3 && bal.gt(20) && rand() < launchProb) {
    const recentTickers = activeTokens.slice(0, 10).map((t) => t.ticker);
    const { system, user } = buildDevLaunchPrompt({
      balance: agent.balance,
      activeTokensCount: mine.length,
      launchFrequency: freq,
      launchStyle: rp.launchStyle ?? LaunchStyle.SPICY,
      recentTickers,
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
        res.parsed.name &&
        res.parsed.liquidity_amount
      ) {
        const liq = Decimal.min(
          new Decimal(res.parsed.liquidity_amount),
          bal.mul("0.5"),
        );
        if (liq.gt(0)) {
          const launched = await launchToken(
            agent.id,
            res.parsed.ticker,
            res.parsed.name,
            liq.toFixed(18),
            "1000000000",
          );
          result.launched = !!launched;
        }
      }
    }
  }

  void poolQueries; // reserved for future use
  return result;
}
