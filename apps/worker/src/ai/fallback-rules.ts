import { Decimal } from "decimal.js";
import { RiskProfile } from "@degenscreener/shared";
import { rand } from "../util/rng.js";

export interface HoldingCtx {
  tokenId: string;
  ticker: string;
  quantity: string;
  avgEntryPrice: string;
  currentPrice: string;
  tokenStatus: "ACTIVE" | "RUGGED" | "DEAD";
}

export interface AgentCtx {
  id: string;
  balance: string;
  riskProfile: { profile?: RiskProfile } & Record<string, unknown>;
}

export type FallbackAction =
  | { kind: "SELL_ALL"; tokenId: string; reason: string }
  | { kind: "SELL_HALF"; tokenId: string; reason: string }
  | { kind: "HOLD"; reason: string };

export interface FallbackResult {
  triggered: boolean;
  action?: FallbackAction;
}

// Randomize thresholds ±10%
function jitter(base: number): number {
  return base * (0.9 + rand() * 0.2);
}

function stopLossPctFor(profile?: RiskProfile): number | null {
  switch (profile) {
    case RiskProfile.CONSERVATIVE:
      return -30;
    case RiskProfile.MODERATE:
      return -50;
    case RiskProfile.AGGRESSIVE:
      return -70;
    case RiskProfile.FULL_DEGEN:
      return null;
    default:
      return -50;
  }
}

export function checkFallbackRules(
  agent: AgentCtx,
  holdings: HoldingCtx[],
): FallbackResult {
  // Rule 1: force sell rugged tokens
  for (const h of holdings) {
    if (h.tokenStatus === "RUGGED" && new Decimal(h.quantity).gt(0)) {
      return {
        triggered: true,
        action: {
          kind: "SELL_ALL",
          tokenId: h.tokenId,
          reason: "Token rugged - exit immediately",
        },
      };
    }
  }

  // Rule 2: take-profit at ~5x
  const tpMultiplier = jitter(5);
  for (const h of holdings) {
    const entry = new Decimal(h.avgEntryPrice);
    if (entry.lte(0)) continue;
    const mult = new Decimal(h.currentPrice).div(entry);
    if (mult.gte(tpMultiplier)) {
      return {
        triggered: true,
        action: {
          kind: "SELL_HALF",
          tokenId: h.tokenId,
          reason: `Take-profit at ${mult.toFixed(2)}x`,
        },
      };
    }
  }

  // Rule 3: stop-loss (profile-dependent)
  const slPct = stopLossPctFor(agent.riskProfile.profile);
  if (slPct !== null) {
    const jittered = jitter(Math.abs(slPct));
    for (const h of holdings) {
      const entry = new Decimal(h.avgEntryPrice);
      if (entry.lte(0)) continue;
      const pct = new Decimal(h.currentPrice)
        .sub(entry)
        .div(entry)
        .mul(100);
      if (pct.lte(-jittered)) {
        return {
          triggered: true,
          action: {
            kind: "SELL_ALL",
            tokenId: h.tokenId,
            reason: `Stop-loss at ${pct.toFixed(1)}%`,
          },
        };
      }
    }
  }

  // Rule 4: insufficient balance → HOLD
  if (new Decimal(agent.balance).lt("0.1")) {
    return {
      triggered: true,
      action: { kind: "HOLD", reason: "Insufficient balance" },
    };
  }

  return { triggered: false };
}
