import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFallbackRules } from "./fallback-rules.js";
import { RiskProfile } from "@degenscreener/shared";
import { seedRng } from "../util/rng.js";

test("rugged token forces SELL_ALL", () => {
  seedRng(1);
  const r = checkFallbackRules(
    { id: "a", balance: "100", riskProfile: { profile: RiskProfile.MODERATE } },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "0",
        tokenStatus: "RUGGED",
      },
    ],
  );
  assert.equal(r.triggered, true);
  assert.equal(r.action?.kind, "SELL_ALL");
});

test("dead token forces SELL_ALL", () => {
  seedRng(1);
  const r = checkFallbackRules(
    { id: "a", balance: "100", riskProfile: { profile: RiskProfile.MODERATE } },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "0",
        tokenStatus: "DEAD",
      },
    ],
  );
  assert.equal(r.triggered, true);
  assert.equal(r.action?.kind, "SELL_ALL");
});

test("low ETH balance forces HOLD (gas check)", () => {
  seedRng(5);
  const r = checkFallbackRules(
    { id: "a", balance: "0.0001", ethBalance: "0.0001", riskProfile: { profile: RiskProfile.MODERATE } },
    [],
  );
  assert.equal(r.triggered, true);
  assert.equal(r.action?.kind, "HOLD");
});

test("6x holding does NOT trigger — Claude decides", () => {
  seedRng(2);
  const r = checkFallbackRules(
    { id: "a", balance: "100", riskProfile: { profile: RiskProfile.MODERATE } },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "6",
        tokenStatus: "ACTIVE",
      },
    ],
  );
  assert.equal(r.triggered, false);
});

test("-95% loss does NOT trigger for any profile — Claude decides", () => {
  seedRng(3);
  for (const profile of [RiskProfile.CONSERVATIVE, RiskProfile.MODERATE, RiskProfile.AGGRESSIVE, RiskProfile.FULL_DEGEN]) {
    const r = checkFallbackRules(
      { id: "a", balance: "100", riskProfile: { profile } },
      [
        {
          tokenId: "t1",
          ticker: "X",
          quantity: "100",
          avgEntryPrice: "1",
          currentPrice: "0.05",
          tokenStatus: "ACTIVE",
        },
      ],
    );
    assert.equal(r.triggered, false, `${profile} should not trigger on loss`);
  }
});

test("graduated token in profit does NOT trigger — Claude decides", () => {
  seedRng(4);
  const r = checkFallbackRules(
    { id: "a", balance: "100", riskProfile: { profile: RiskProfile.MODERATE } },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "5",
        tokenStatus: "ACTIVE",
        phase: "GRADUATED",
      },
    ],
  );
  assert.equal(r.triggered, false);
});

test("healthy holdings — no rules trigger", () => {
  seedRng(6);
  const r = checkFallbackRules(
    { id: "a", balance: "100", riskProfile: { profile: RiskProfile.MODERATE } },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "1.2",
        tokenStatus: "ACTIVE",
      },
    ],
  );
  assert.equal(r.triggered, false);
});
