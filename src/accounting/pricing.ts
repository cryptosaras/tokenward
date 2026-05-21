// Cost computation over the versioned pricing snapshot.
//
// IMPORTANT: every USD figure produced here is an ESTIMATE. JSONL usage is a
// known-unreliable signal (RESEARCH.md §3.4) and the pricing table is a dated
// snapshot. Callers MUST label outputs as estimates to the user.
//
// Rates are per-MTok, so token counts are divided by 1_000_000. Cache-write and
// cache-read rates are derived from baseInput via the multiplier rule unless the
// resolved ModelPricing (after override merge) pins them explicitly.
import type { CallUsage, PricingTable, ModelPricing } from "../types.js";
import { PRICING_TABLE as BUNDLED } from "./pricing-data.js";

export const PRICING_TABLE: PricingTable = BUNDLED;

const PER_MTOK = 1_000_000;

// Multiplier rule (RESEARCH.md §3.5): derived from baseInput when not pinned.
const CACHE_WRITE_5M_MULT = 1.25;
const CACHE_WRITE_1H_MULT = 2;
const CACHE_READ_MULT = 0.1;

// inference_geo "us" applies a 1.1x surcharge to the token-derived cost.
const US_GEO_MULT = 1.1;

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Resolve effective pricing for a model id.
 *
 * Matching is by substring, most-specific (longest `match`) first, so
 * "opus-4-1" wins over bare "opus" regardless of table order. A matching
 * override (negotiated rate) is shallow-merged on top of the bundled entry, so
 * a pinned override field wins over the snapshot value.
 *
 * Returns undefined when nothing matches.
 */
export function resolveModelPricing(
  modelId: string,
  table: PricingTable = PRICING_TABLE,
  overrides?: Record<string, Partial<ModelPricing>>,
): ModelPricing | undefined {
  const id = typeof modelId === "string" ? modelId : "";
  if (!id) return undefined;

  // Most-specific match first (defensive sort; does not mutate the table).
  const sorted = [...table.models].sort(
    (a, b) => b.match.length - a.match.length,
  );
  const base = sorted.find((m) => m.match && id.includes(m.match));
  if (!base) return undefined;

  let resolved: ModelPricing = { ...base };

  // Apply overrides whose key is a substring of the model id. Longest key wins.
  if (overrides) {
    const keys = Object.keys(overrides)
      .filter((k) => k && id.includes(k))
      .sort((a, b) => b.length - a.length);
    const key = keys[0];
    if (key) {
      const ov = overrides[key];
      if (ov) resolved = { ...resolved, ...ov };
    }
  }

  return resolved;
}

/** Effective cache-write/read rates, honoring pinned values then multipliers. */
function effectiveRates(p: ModelPricing): {
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
} {
  return {
    cacheWrite5m:
      typeof p.cacheWrite5m === "number"
        ? p.cacheWrite5m
        : p.baseInput * CACHE_WRITE_5M_MULT,
    cacheWrite1h:
      typeof p.cacheWrite1h === "number"
        ? p.cacheWrite1h
        : p.baseInput * CACHE_WRITE_1H_MULT,
    cacheRead:
      typeof p.cacheRead === "number"
        ? p.cacheRead
        : p.baseInput * CACHE_READ_MULT,
  };
}

/**
 * USD cost for ONE already-deduped API call. Returns 0 when the model can't be
 * priced (unknown id) so callers never see NaN. ESTIMATE — see file header.
 */
export function priceCall(
  usage: CallUsage,
  modelId: string,
  table: PricingTable = PRICING_TABLE,
  overrides?: Record<string, Partial<ModelPricing>>,
): number {
  const p = resolveModelPricing(modelId, table, overrides);
  if (!p) return 0;
  const r = effectiveRates(p);

  const tokenCost =
    (num(usage.inputTokens) * p.baseInput +
      num(usage.cacheWrite5mTokens) * r.cacheWrite5m +
      num(usage.cacheWrite1hTokens) * r.cacheWrite1h +
      num(usage.cacheReadTokens) * r.cacheRead +
      num(usage.outputTokens) * p.output) /
    PER_MTOK;

  // us-geo surcharge applies to token-derived cost only, not web search.
  const geoAdjusted = usage.inferenceGeo === "us" ? tokenCost * US_GEO_MULT : tokenCost;

  const webCost =
    (num(usage.webSearchRequests) / 1000) * num(table.webSearchPer1k);

  return geoAdjusted + webCost;
}

/**
 * Rough pre-execution estimate for escalation messaging. Treats the supplied
 * counts as input/output/cache-read only (no cache writes, no web search, no
 * geo surcharge) — it is deliberately a lower-effort approximation. ESTIMATE.
 */
export function estimateCallUsd(
  modelId: string,
  opts: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number },
  table: PricingTable = PRICING_TABLE,
  overrides?: Record<string, Partial<ModelPricing>>,
): number {
  const usage: CallUsage = {
    inputTokens: num(opts.inputTokens),
    outputTokens: num(opts.outputTokens),
    cacheReadTokens: num(opts.cacheReadTokens),
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    webSearchRequests: 0,
  };
  return priceCall(usage, modelId, table, overrides);
}
