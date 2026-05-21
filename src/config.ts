// Config loading and merging. Precedence (high -> low):
//   project .tokenwarden.json  >  ~/.tokenwarden.json  >  built-in defaults.
// Always returns a complete Config; missing keys fall back to defaults.
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config, Budget } from "./types.js";
import { readJsonSafe } from "./util.js";

const NO_CAP: Budget = { usd: null };

/**
 * Defaults are deliberately conservative and observe-only. The first session
 * never blocks; users opt into enforcement (PLAN §6: earns trust).
 */
export const DEFAULT_CONFIG: Config = {
  mode: "observe",
  budgets: {
    session: { usd: 5 },
    daily: { usd: 25 },
    project: { ...NO_CAP },
    perModel: {},
  },
  compaction: {
    coachAtPercent: 80,
    vetoAutoBelowPercent: 50,
  },
  escalation: {
    enabled: true,
    expensiveModels: ["opus"],
    trivialThresholdUsd: 0.5,
  },
  bloat: {
    readMaxLines: 2000,
    refuseUnscopedSearch: true,
    bashMaxTimeoutMs: 600000,
  },
  pricingOverrides: {},
};

/** Deep-merge a partial config over a base, one level into nested objects. */
function merge(base: Config, over: Partial<Config> | undefined): Config {
  if (!over || typeof over !== "object") return base;
  return {
    mode: over.mode ?? base.mode,
    budgets: {
      session: { ...base.budgets.session, ...over.budgets?.session },
      daily: { ...base.budgets.daily, ...over.budgets?.daily },
      project: { ...base.budgets.project, ...over.budgets?.project },
      perModel: { ...base.budgets.perModel, ...over.budgets?.perModel },
    },
    compaction: { ...base.compaction, ...over.compaction },
    escalation: { ...base.escalation, ...over.escalation },
    bloat: { ...base.bloat, ...over.bloat },
    pricingOverrides: { ...base.pricingOverrides, ...over.pricingOverrides },
  };
}

export function userConfigPath(): string {
  return join(homedir(), ".tokenwarden.json");
}

export function projectConfigPath(cwd: string): string {
  return join(cwd, ".tokenwarden.json");
}

/** Load the effective config for a working directory. Never throws. */
export function loadConfig(cwd: string = process.cwd()): Config {
  const user = readJsonSafe<Partial<Config>>(userConfigPath(), {});
  const project = readJsonSafe<Partial<Config>>(projectConfigPath(cwd), {});
  return merge(merge(DEFAULT_CONFIG, user), project);
}
