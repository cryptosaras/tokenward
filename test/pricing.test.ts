import { test } from "node:test";
import assert from "node:assert/strict";
import type { CallUsage, ModelPricing } from "../src/types.js";
import {
  PRICING_TABLE,
  resolveModelPricing,
  priceCall,
  estimateCallUsd,
} from "../src/accounting/pricing.js";

function zeroUsage(over: Partial<CallUsage> = {}): CallUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    webSearchRequests: 0,
    ...over,
  };
}

test("PRICING_TABLE snapshot metadata", () => {
  assert.equal(PRICING_TABLE.updated, "2026-05-21");
  assert.equal(PRICING_TABLE.source, "platform.claude.com");
  assert.equal(PRICING_TABLE.webSearchPer1k, 10);
});

test("resolveModelPricing: specificity — opus-4-1 beats bare opus", () => {
  const p41 = resolveModelPricing("claude-opus-4-1-20250805");
  assert.ok(p41);
  assert.equal(p41.baseInput, 15);
  assert.equal(p41.output, 75);

  const p47 = resolveModelPricing("claude-opus-4-7-20260101");
  assert.ok(p47);
  assert.equal(p47.baseInput, 5);
  assert.equal(p47.output, 25);

  // A model id that only contains bare "opus" still resolves to the Opus tier.
  const bare = resolveModelPricing("some-opus-model");
  assert.ok(bare);
  assert.equal(bare.baseInput, 5);
});

test("resolveModelPricing: sonnet and haiku, unknown returns undefined", () => {
  assert.equal(resolveModelPricing("claude-sonnet-4-6")!.baseInput, 3);
  assert.equal(resolveModelPricing("claude-haiku-4-5")!.baseInput, 1);
  assert.equal(resolveModelPricing("gpt-4o"), undefined);
  assert.equal(resolveModelPricing(""), undefined);
});

test("priceCall: known usage math for Opus 4.7", () => {
  // 1M input @ $5, 1M output @ $25, 1M cacheRead @ $0.50 = 5 + 25 + 0.5 = 30.5
  const usage = zeroUsage({
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
  });
  const cost = priceCall(usage, "claude-opus-4-7");
  assert.equal(cost, 30.5);
});

test("priceCall: multiplier-derived cache-write rates (Opus 4.7)", () => {
  // 5m write = 1.25 * 5 = $6.25/MTok; 1h write = 2 * 5 = $10/MTok.
  const usage = zeroUsage({
    cacheWrite5mTokens: 1_000_000,
    cacheWrite1hTokens: 1_000_000,
  });
  const cost = priceCall(usage, "claude-opus-4-7");
  assert.equal(cost, 6.25 + 10);
});

test("priceCall: us inference_geo applies 1.1x to token cost only", () => {
  const base = zeroUsage({ inputTokens: 1_000_000 }); // $5
  const us = zeroUsage({ inputTokens: 1_000_000, inferenceGeo: "us" });
  assert.equal(priceCall(base, "claude-opus-4-7"), 5);
  // 5 * 1.1 = 5.5
  assert.ok(Math.abs(priceCall(us, "claude-opus-4-7") - 5.5) < 1e-9);
});

test("priceCall: web search billed $10/1k, NOT geo-multiplied", () => {
  // 2000 web search requests = 2 * $10 = $20, regardless of geo.
  const usage = zeroUsage({ webSearchRequests: 2000, inferenceGeo: "us" });
  assert.equal(priceCall(usage, "claude-opus-4-7"), 20);

  // Combined: 1M input ($5 * 1.1 = 5.5) + 1000 web ($10) = 15.5
  const combo = zeroUsage({
    inputTokens: 1_000_000,
    webSearchRequests: 1000,
    inferenceGeo: "us",
  });
  assert.ok(Math.abs(priceCall(combo, "claude-opus-4-7") - 15.5) < 1e-9);
});

test("priceCall: override applies and pinned cacheWrite5m wins over multiplier", () => {
  const overrides: Record<string, Partial<ModelPricing>> = {
    "opus-4-7": { baseInput: 2, cacheWrite5m: 1 },
  };
  // input 1M @ overridden $2 = 2; cacheWrite5m 1M @ pinned $1 = 1 -> total 3.
  const usage = zeroUsage({
    inputTokens: 1_000_000,
    cacheWrite5mTokens: 1_000_000,
  });
  const cost = priceCall(usage, "claude-opus-4-7", PRICING_TABLE, overrides);
  assert.equal(cost, 3);

  // Override did not pin cacheWrite1h, so multiplier over NEW baseInput applies:
  // 2 * 2 = $4/MTok.
  const u1h = zeroUsage({ cacheWrite1hTokens: 1_000_000 });
  assert.equal(priceCall(u1h, "claude-opus-4-7", PRICING_TABLE, overrides), 4);
});

test("priceCall: unknown model returns 0 (never NaN)", () => {
  const cost = priceCall(zeroUsage({ inputTokens: 1_000_000 }), "mystery");
  assert.equal(cost, 0);
});

test("estimateCallUsd: approximates input/output/cacheRead only", () => {
  // 1M input @ $5 + 1M output @ $25 = 30
  const est = estimateCallUsd("claude-opus-4-7", {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  assert.equal(est, 30);
});
