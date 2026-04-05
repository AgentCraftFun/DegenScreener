import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreSentiment } from "./scorer.js";

test("bullish keywords", () => {
  const s = scoreSentiment("this is a gem, moon soon, bullish");
  assert.ok(s > 0.4);
});

test("bearish keywords", () => {
  const s = scoreSentiment("total rug, scam, dump incoming, ngmi");
  assert.ok(s < -0.5);
});

test("ALL CAPS amplifier", () => {
  const lo = scoreSentiment("moon");
  const hi = scoreSentiment("MOON MOON MOON");
  assert.ok(Math.abs(hi) >= Math.abs(lo) * 1.2);
});

test("exclamation amplifier", () => {
  const a = scoreSentiment("bullish");
  const b = scoreSentiment("bullish!!!");
  assert.ok(b > a);
});

test("clamped to [-1, 1]", () => {
  const s = scoreSentiment("MOON MOON MOON LFG LFG BULLISH 100X APE APE BASED!!!");
  assert.ok(s >= -1 && s <= 1);
});

test("neutral", () => {
  const s = scoreSentiment("hello world");
  assert.equal(s, 0);
});
