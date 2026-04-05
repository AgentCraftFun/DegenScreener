import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost } from "./cost-tracker.js";

test("haiku cost", () => {
  const c = estimateCost(1_000_000, 1_000_000, "claude-haiku-4-5");
  assert.ok(Math.abs(c - 1.5) < 0.001);
});
test("sonnet cost", () => {
  const c = estimateCost(1_000_000, 1_000_000, "claude-sonnet-4-6");
  assert.ok(Math.abs(c - 18) < 0.001);
});
test("gpt-4o-mini cost", () => {
  const c = estimateCost(1_000_000, 1_000_000, "gpt-4o-mini");
  assert.ok(Math.abs(c - 0.75) < 0.001);
});
test("small token counts", () => {
  const c = estimateCost(500, 200, "claude-haiku-4-5");
  assert.ok(c > 0 && c < 0.001);
});
