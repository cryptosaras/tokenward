// Versioned pricing snapshot (per-MTok USD), verified 2026-05-21 against
// platform.claude.com (see RESEARCH.md §3.5). All dollar figures derived from
// this table are ESTIMATES — Anthropic billing is authoritative.
//
// Rates intentionally OMIT cacheWrite5m/cacheWrite1h so the multiplier rule
// (5m = 1.25x baseInput, 1h = 2x baseInput, cacheRead = 0.1x baseInput) is the
// single source of truth. The `cacheRead` value below already encodes 0.1x.
//
// `models` is ordered most-specific-first (longest `match` substring first) so
// "opus-4-1" wins over bare "opus". resolveModelPricing also sorts defensively.
import type { PricingTable } from "../types.js";

export const PRICING_TABLE: PricingTable = {
  updated: "2026-05-21",
  source: "platform.claude.com",
  webSearchPer1k: 10,
  models: [
    // Opus 4.1 — legacy premium tier. Must precede bare "opus".
    { match: "opus-4-1", baseInput: 15, output: 75, cacheRead: 1.5 },
    // Opus 4.7 / 4.6 / 4.5 — current Opus tier.
    { match: "opus-4-7", baseInput: 5, output: 25, cacheRead: 0.5 },
    { match: "opus-4-6", baseInput: 5, output: 25, cacheRead: 0.5 },
    { match: "opus-4-5", baseInput: 5, output: 25, cacheRead: 0.5 },
    // Sonnet 4.6 / 4.5.
    { match: "sonnet", baseInput: 3, output: 15, cacheRead: 0.3 },
    // Haiku 4.5.
    { match: "haiku", baseInput: 1, output: 5, cacheRead: 0.1 },
    // Bare "opus" fallback — least specific Opus match, evaluated last.
    { match: "opus", baseInput: 5, output: 25, cacheRead: 0.5 },
  ],
};
