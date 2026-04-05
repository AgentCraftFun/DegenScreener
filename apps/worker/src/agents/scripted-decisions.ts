import { Decimal } from "decimal.js";
import { rand, randInt, randomHexTicker, randChoice } from "../util/rng.js";
import type { schema } from "@degenscreener/db";

type Agent = typeof schema.agents.$inferSelect;
type Token = typeof schema.tokens.$inferSelect;
type Holding = typeof schema.agentHoldings.$inferSelect;

export type DevDecision =
  | {
      kind: "LAUNCH";
      ticker: string;
      name: string;
      initialLiquidity: string;
    }
  | { kind: "RUG"; tokenId: string }
  | { kind: "NONE" };

export function getScriptedDevDecision(
  agent: Agent,
  activeTokens: Token[],
  currentTick: number,
): DevDecision {
  const mine = activeTokens.filter((t) => t.creatorAgentId === agent.id);
  const bal = new Decimal(agent.balance);

  const rp = (agent.riskProfile as { rugProbability?: number }) ?? {};
  const rugProb = typeof rp.rugProbability === "number" ? rp.rugProbability : 0;

  // Rug roll first
  if (mine.length > 0 && rand() < rugProb) {
    const oldest = mine.reduce((a, b) =>
      a.createdAt < b.createdAt ? a : b,
    );
    return { kind: "RUG", tokenId: oldest.id };
  }

  // Launch conditions
  if (mine.length < 3 && bal.gt(20) && currentTick % 10 === 0) {
    const liq = randInt(5, Math.min(50, Math.floor(bal.toNumber())));
    const ticker = "$TEST" + randomHexTicker(4);
    return {
      kind: "LAUNCH",
      ticker,
      name: `TestToken ${ticker}`,
      initialLiquidity: String(liq),
    };
  }

  return { kind: "NONE" };
}

export type DegenDecision =
  | { kind: "BUY"; tokenId: string; dscreenAmount: string }
  | { kind: "SELL"; tokenId: string; tokenAmount: string }
  | { kind: "HOLD" };

export function getScriptedDegenDecision(
  agent: Agent,
  activeTokens: Token[],
  holdings: Holding[],
): DegenDecision {
  const roll = rand();
  const bal = new Decimal(agent.balance);

  if (roll < 0.4 && activeTokens.length > 0 && bal.gt("0.5")) {
    const tk = randChoice(activeTokens);
    if (!tk) return { kind: "HOLD" };
    const pct = 1 + rand() * 9; // 1-10%
    const amt = bal.mul(pct).div(100);
    if (amt.lte(0)) return { kind: "HOLD" };
    return {
      kind: "BUY",
      tokenId: tk.id,
      dscreenAmount: amt.toFixed(18),
    };
  }

  if (roll < 0.6 && holdings.length > 0) {
    const h = randChoice(holdings);
    if (!h) return { kind: "HOLD" };
    const qty = new Decimal(h.quantity).mul("0.5");
    if (qty.lte(0)) return { kind: "HOLD" };
    return {
      kind: "SELL",
      tokenId: h.tokenId,
      tokenAmount: qty.toFixed(18),
    };
  }

  return { kind: "HOLD" };
}
