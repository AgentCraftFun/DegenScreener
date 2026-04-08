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

test("6x holding triggers take-profit SELL_HALF", () => {
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
  assert.equal(r.triggered, true);
  assert.equal(r.action?.kind, "SELL_HALF");
});

test("-40% loss triggers stop-loss for Conservative", () => {
  seedRng(3);
  const r = checkFallbackRules(
    {
      id: "a",
      balance: "100",
      riskProfile: { profile: RiskProfile.CONSERVATIVE },
    },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "0.6",
        tokenStatus: "ACTIVE",
      },
    ],
  );
  assert.equal(r.triggered, true);
  assert.equal(r.action?.kind, "SELL_ALL");
});

test("Full Degen has no stop-loss", () => {
  seedRng(4);
  const r = checkFallbackRules(
    {
      id: "a",
      balance: "100",
      riskProfile: { profile: RiskProfile.FULL_DEGEN },
    },
    [
      {
        tokenId: "t1",
        ticker: "X",
        quantity: "100",
        avgEntryPrice: "1",
        currentPrice: "0.05", // 95% loss
        tokenStatus: "ACTIVE",
      },
    ],
  );
  assert.equal(r.triggered, false);
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

test("low ETH balance forces HOLD (balance threshold)", () => {
  seedRng(5);
  const r = checkFallbackRules(
    { id: "a", balance: "0.0008", ethBalance: "0.0008", riskProfile: { profile: RiskProfile.MODERATE } },
    [],
  );
  assert.equal(r.triggered, true);
  assert.equal(r.action?.kind, "HOLD");
});

test("no rules trigger with healthy holdings", () => {
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
