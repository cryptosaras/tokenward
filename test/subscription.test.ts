import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Config, StatuslineSnapshot } from "../src/types.js";
import { DEFAULT_CONFIG, resolveUsageCaps, PLAN_LIMITS } from "../src/config.js";
import { JsonLedger } from "../src/accounting/ledger.js";
import { checkUsageWindows } from "../src/hooks/pretool.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function cfg(sub: Partial<Config["subscription"]>): Config {
  const c = structuredClone(DEFAULT_CONFIG);
  c.subscription = { ...c.subscription, ...sub };
  return c;
}

function snap(over: Partial<StatuslineSnapshot> & { sessionId: string; totalCostUsd: number; capturedAt: number }): StatuslineSnapshot {
  return {
    modelId: over.modelId ?? "claude-opus-4-7",
    modelDisplayName: "",
    cwd: over.cwd ?? "/proj",
    contextUsedPercent: null,
    contextWindowSize: 200000,
    exceeds200k: false,
    ...over,
  };
}

// --- resolveUsageCaps --------------------------------------------------------

test("resolveUsageCaps: plan with null windows uses the built-in estimate table", () => {
  const caps = resolveUsageCaps(cfg({ plan: "max5x" }));
  assert.equal(caps.fiveHourUsd, PLAN_LIMITS.max5x.fiveHourUsd);
  assert.equal(caps.weeklyUsd, PLAN_LIMITS.max5x.weeklyUsd);
});

test("resolveUsageCaps: explicit window overrides the table", () => {
  const caps = resolveUsageCaps(cfg({ plan: "max5x", fiveHour: { usd: 40 } }));
  assert.equal(caps.fiveHourUsd, 40); // explicit wins
  assert.equal(caps.weeklyUsd, PLAN_LIMITS.max5x.weeklyUsd); // weekly still from table
});

test("resolveUsageCaps: every tier resolves and the three differ", () => {
  const pro = resolveUsageCaps(cfg({ plan: "pro" })).weeklyUsd!;
  const m5 = resolveUsageCaps(cfg({ plan: "max5x" })).weeklyUsd!;
  const m20 = resolveUsageCaps(cfg({ plan: "max20x" })).weeklyUsd!;
  assert.ok(pro < m5 && m5 < m20, "ceilings should grow pro < max5x < max20x");
});

test("resolveUsageCaps: custom plan uses only explicit values (no table)", () => {
  const caps = resolveUsageCaps(cfg({ plan: "custom", weekly: { usd: 77 } }));
  assert.equal(caps.weeklyUsd, 77);
  assert.equal(caps.fiveHourUsd, null); // no table for custom, none given
});

test("resolveUsageCaps: no plan disables the feature (null ceilings)", () => {
  const caps = resolveUsageCaps(cfg({ plan: null }));
  assert.equal(caps.fiveHourUsd, null);
  assert.equal(caps.weeklyUsd, null);
});

// --- window-delta math (the core correctness concern) ------------------------

test("ledger windows take cumulative DELTAS, not whole-session totals", () => {
  const path = join(tmpdir(), `tw-sub-${process.pid}-${Date.now()}.json`);
  const l = new JsonLedger(path);
  const now = Date.now();

  // Session A: long-running. Started 8h ago at $2, now at $10 (still active).
  // Only $8 of growth is observable, and it lands inside the last 5h window.
  l.recordStatusline(snap({ sessionId: "A", totalCostUsd: 2, capturedAt: now - 8 * HOUR }));
  l.recordStatusline(snap({ sessionId: "A", totalCostUsd: 10, capturedAt: now - 10 * 60 * 1000 }));

  // Session B: entirely OUTSIDE the 5h window (6-7h ago), $1 -> $3.
  l.recordStatusline(snap({ sessionId: "B", totalCostUsd: 1, capturedAt: now - 7 * HOUR }));
  l.recordStatusline(snap({ sessionId: "B", totalCostUsd: 3, capturedAt: now - 6 * HOUR }));

  const agg = l.aggregates("A", "/proj");

  // 5h: only A's $8 delta (B's growth happened before the window).
  assert.ok(Math.abs(agg.fiveHourUsd - 8) < 0.01, `5h should be ~8, got ${agg.fiveHourUsd}`);
  // 7d: A's $10 (baseline 0, started in window) + B's $3 = $13.
  assert.ok(Math.abs(agg.weeklyUsd - 13) < 0.01, `7d should be ~13, got ${agg.weeklyUsd}`);
});

test("ledger windows split spend by model class", () => {
  const path = join(tmpdir(), `tw-sub2-${process.pid}-${Date.now()}.json`);
  const l = new JsonLedger(path);
  const now = Date.now();
  l.recordStatusline(snap({ sessionId: "O", modelId: "claude-opus-4-7", totalCostUsd: 6, capturedAt: now - HOUR }));
  l.recordStatusline(snap({ sessionId: "S", modelId: "claude-sonnet-4-6", totalCostUsd: 2, capturedAt: now - HOUR }));

  const agg = l.aggregates("O", "/proj");
  assert.ok(Math.abs((agg.fiveHourByClass.opus ?? 0) - 6) < 0.01);
  assert.ok(Math.abs((agg.fiveHourByClass.sonnet ?? 0) - 2) < 0.01);
});

test("ledger drops samples older than the retention window", () => {
  const path = join(tmpdir(), `tw-sub3-${process.pid}-${Date.now()}.json`);
  const l = new JsonLedger(path);
  const now = Date.now();
  // A 9-day-old sample is past the 8-day TTL and should be pruned on next write.
  l.recordStatusline(snap({ sessionId: "old", totalCostUsd: 99, capturedAt: now - 9 * DAY }));
  l.recordStatusline(snap({ sessionId: "new", totalCostUsd: 5, capturedAt: now - HOUR }));
  const agg = l.aggregates("new", "/proj");
  assert.ok(Math.abs(agg.weeklyUsd - 5) < 0.01, `stale session must not count, got ${agg.weeklyUsd}`);
});

// --- gate --------------------------------------------------------------------

test("checkUsageWindows: over the 5-hour ceiling yields a usage-framed violation", () => {
  const c = cfg({ plan: "max5x", fiveHour: { usd: 20 } });
  const v = checkUsageWindows(c, { fiveHourUsd: 25, weeklyUsd: 0 });
  assert.ok(v, "should breach the 5h window");
  assert.equal(v!.framing, "usage");
  assert.match(v!.label, /max5x 5-hour/);
});

test("checkUsageWindows: weekly breach fires when 5h is fine", () => {
  const c = cfg({ plan: "pro" });
  const caps = resolveUsageCaps(c);
  const v = checkUsageWindows(c, { fiveHourUsd: 0, weeklyUsd: caps.weeklyUsd! + 1 });
  assert.ok(v);
  assert.match(v!.label, /weekly/);
});

test("checkUsageWindows: no plan means no gate", () => {
  const v = checkUsageWindows(cfg({ plan: null }), { fiveHourUsd: 9999, weeklyUsd: 9999 });
  assert.equal(v, null);
});
