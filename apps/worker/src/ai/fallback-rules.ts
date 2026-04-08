import { Decimal } from "decimal.js";
import { RiskProfile } from "@degenscreener/shared";

export interface HoldingCtx {
  tokenId: string;
  ticker: string;
  quantity: string;
  avgEntryPrice: string;
  currentPrice: string;
  tokenStatus: "ACTIVE" | "RUGGED" | "DEAD";
  phase?: string; // PRE_BOND | GRADUATED
}

export interface AgentCtx {
  id: string;
  balance: string;
  ethBalance?: string;
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

const MIN_GAS_ETH = 0.0005; // 0.0005 ETH — minimum to cover gas

/**
 * Fallback rules — ONLY blockchain-reality constraints.
 * All trading decisions (take-profit, stop-loss, position sizing) are
 * made by Claude via the prompt system. These rules only catch cases
 * where a transaction is physically impossible.
 */
export function checkFallbackRules(
  agent: AgentCtx,
  holdings: HoldingCtx[],
): FallbackResult {
  const ethBal = agent.ethBalance
    ? parseFloat(agent.ethBalance)
    : parseFloat(agent.balance);

  // Rule 1: Can't trade without gas money
  if (ethBal < MIN_GAS_ETH) {
    return {
      triggered: true,
      action: { kind: "HOLD", reason: "Insufficient ETH for gas — needs top-up" },
    };
  }

  // Rule 2: Token is dead/rugged — no market exists to sell into gracefully,
  // but still attempt exit so the agent isn't stuck holding worthless tokens
  for (const h of holdings) {
    if (h.tokenStatus === "RUGGED" || h.tokenStatus === "DEAD") {
      if (new Decimal(h.quantity).gt(0)) {
        return {
          triggered: true,
          action: {
            kind: "SELL_ALL",
            tokenId: h.tokenId,
            reason: `Token ${h.tokenStatus.toLowerCase()} — attempting exit`,
          },
        };
      }
    }
  }

  // No hardcoded trading rules — Claude decides everything else
  return { triggered: false };
}
