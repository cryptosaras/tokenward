// Config loading and merging. Precedence (high -> low):
//   project .tokenwarden.json  >  ~/.tokenwarden.json  >  built-in defaults.
// Always returns a complete Config; missing keys fall back to defaults.
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config, Budget, PlanTier } from "./types.js";
import { readJsonSafe } from "./util.js";

const NO_CAP: Budget = { usd: null };

/**
 * Built-in usage-window ceilings per plan, in API-equivalent USD.
 *
 * THESE ARE ESTIMATES. Anthropic publishes no hard token/dollar numbers for the
 * 5-hour and weekly windows, and they drift. They are deliberately conservative
 * (warn early) starting points — calibrate them against your own throttling.
 * Any explicit `subscription.fiveHour`/`weekly` in config overrides these.
 */
export const PLAN_LIMITS: Record<
  Exclude<PlanTier, "custom">,
  { fiveHourUsd: number; weeklyUsd: number }
> = {
  pro: { fiveHourUsd: 5, weeklyUsd: 30 },
  max5x: { fiveHourUsd: 25, weeklyUsd: 150 },
  max20x: { fiveHourUsd: 100, weeklyUsd: 600 },
};

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
  // Off by default: only flat-fee subscribers want usage windows. API users
  // keep the dollar `budgets` above. Set `plan` to opt in.
  subscription: {
    plan: null,
    fiveHour: { usd: null },
    weekly: { usd: null },
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
    subscription: {
      // `plan` may be intentionally null, so check presence, not truthiness.
      plan:
        over.subscription?.plan !== undefined
          ? over.subscription.plan
          : base.subscription.plan,
      fiveHour: { ...base.subscription.fiveHour, ...over.subscription?.fiveHour },
      weekly: { ...base.subscription.weekly, ...over.subscription?.weekly },
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

/**
 * Resolve effective usage-window ceilings (API-equivalent USD).
 * Precedence: explicit `subscription.fiveHour/weekly` > built-in plan estimate >
 * none. Returns `null` ceilings when no plan is set (feature off).
 */
export function resolveUsageCaps(config: Config): {
  fiveHourUsd: number | null;
  weeklyUsd: number | null;
} {
  const s = config.subscription;
  const table = s.plan && s.plan !== "custom" ? PLAN_LIMITS[s.plan] : undefined;
  return {
    fiveHourUsd: s.fiveHour.usd ?? table?.fiveHourUsd ?? null,
    weeklyUsd: s.weekly.usd ?? table?.weeklyUsd ?? null,
  };
}
