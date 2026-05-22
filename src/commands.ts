// Human-facing CLI command implementations: status, report, inspect, doctor, init.
//
// Every dollar figure these print is an ESTIMATE (JSONL is a lower-bound signal;
// statusline is the more reliable live signal). We label them as such everywhere.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CallUsage } from "./types.js";
import { loadConfig, projectConfigPath, resolveUsageCaps } from "./config.js";
import { openLedger, ledgerPath } from "./accounting/ledger.js";
import {
  stateDir,
  usd,
  localDate,
  writeJsonAtomic,
  readJsonSafe,
} from "./util.js";
import {
  resolveSettingsPath,
  hooksInstalled,
  statuslineHint,
  type InstallOptions,
} from "./install.js";

// Accounting modules are built by another agent; import against frozen signatures.
// We import dynamically inside `report` so the CLI compiles/runs even before they
// land, and `report` degrades gracefully if they're missing.
type JsonlModule = {
  findTranscripts(opts?: { cwd?: string }): string[];
  parseTranscript(path: string): {
    sessionId: string;
    cwd: string;
    calls: CallUsage[];
  };
  sumUsage(calls: CallUsage[]): CallUsage;
};
type PricingModule = {
  priceCall(
    usage: CallUsage,
    modelId: string,
    table?: unknown,
    overrides?: unknown,
  ): number;
  PRICING_TABLE: { updated: string; source: string };
};

function out(line = ""): void {
  process.stdout.write(line + "\n");
}

function capLabel(cap: number | null): string {
  return cap === null ? "no cap" : usd(cap);
}

function pctOf(spent: number, cap: number | null): string {
  if (cap === null || cap <= 0) return "";
  const pct = Math.round((spent / cap) * 100);
  return ` (${pct}% of cap)`;
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

export function status(cwd: string = process.cwd()): number {
  const config = loadConfig(cwd);
  const ledger = openLedger();
  const state = ledger.read();

  // Pick the most-recently-updated session as "current" for display.
  const sessions = Object.values(state.sessions);
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  const current = sessions[0];
  const sessionId = current?.sessionId ?? "";
  const agg = ledger.aggregates(sessionId, cwd);

  out("tokenwarden status  (all $ are estimates)");
  out(`  mode:     ${config.mode}`);
  out("");
  out("  spend vs caps:");
  out(
    `    session:  ${usd(agg.sessionUsd)} / ${capLabel(config.budgets.session.usd)}${pctOf(agg.sessionUsd, config.budgets.session.usd)}`,
  );
  out(
    `    today:    ${usd(agg.dailyUsd)} / ${capLabel(config.budgets.daily.usd)}${pctOf(agg.dailyUsd, config.budgets.daily.usd)}`,
  );
  out(
    `    project:  ${usd(agg.projectUsd)} / ${capLabel(config.budgets.project.usd)}${pctOf(agg.projectUsd, config.budgets.project.usd)}`,
  );

  // Subscription usage windows — only shown when a plan is configured.
  if (config.subscription.plan) {
    const caps = resolveUsageCaps(config);
    out("");
    out(`  subscription usage  (plan: ${config.subscription.plan}; API-equivalent estimate, local lower-bound):`);
    out(
      `    last 5h:  ${usd(agg.fiveHourUsd)} / ${capLabel(caps.fiveHourUsd)}${pctOf(agg.fiveHourUsd, caps.fiveHourUsd)}`,
    );
    out(
      `    last 7d:  ${usd(agg.weeklyUsd)} / ${capLabel(caps.weeklyUsd)}${pctOf(agg.weeklyUsd, caps.weeklyUsd)}`,
    );
    out("    (ceilings are ESTIMATES — calibrate to your own throttling.)");
  }
  out("");

  const settingsPath = resolveSettingsPath({ cwd });
  const ins = hooksInstalled(settingsPath);
  out(`  hooks installed: ${ins.hooksPresent ? "yes" : "no"}  (${settingsPath})`);
  out(
    `  statusLine:      ${ins.statuslineOurs ? "tokenwarden (live cost capture on)" : ins.statuslinePresent ? "set, but not tokenwarden" : "not set"}`,
  );
  if (!ins.hooksPresent) {
    out("");
    out("  hooks are not installed — run `tokenwarden install`.");
  }
  return 0;
}

// ---------------------------------------------------------------------------
// report (retrospective, from JSONL transcripts)
// ---------------------------------------------------------------------------

export async function report(cwd: string = process.cwd()): Promise<number> {
  let jsonl: JsonlModule;
  let pricing: PricingModule;
  try {
    jsonl = (await import("./accounting/jsonl.js")) as unknown as JsonlModule;
    pricing = (await import("./accounting/pricing.js")) as unknown as PricingModule;
  } catch {
    out("report: accounting modules unavailable (jsonl/pricing not built yet).");
    return 0;
  }

  const config = loadConfig(cwd);
  let paths: string[];
  try {
    paths = jsonl.findTranscripts();
  } catch {
    paths = [];
  }

  if (!paths.length) {
    out("report: no transcripts found.");
    out("  (Looked in ~/.claude/projects and CLAUDE_CONFIG_DIR if set.)");
    return 0;
  }

  const today = localDate();
  // 7-day window inclusive of today.
  const windowDates = new Set<string>();
  for (let i = 0; i < 7; i++) {
    windowDates.add(localDate(Date.now() - i * 86_400_000));
  }

  const byDay = new Map<string, number>();
  const byModel = new Map<string, number>();
  let todayTotal = 0;
  let weekTotal = 0;

  // We don't have a reliable per-call timestamp, so we attribute a transcript's
  // spend to the file's mtime date (fallback: today). This keeps `report` honest
  // (a lower-bound) and dependency-free. Each call carries its own model id, so
  // we price per call and attribute spend to the real model.
  const { statSync } = await import("node:fs");
  for (const p of paths) {
    let parsed: { sessionId: string; cwd: string; calls: CallUsage[] };
    try {
      parsed = jsonl.parseTranscript(p);
    } catch {
      continue;
    }
    if (!parsed.calls.length) continue;

    let day = today;
    try {
      day = localDate(statSync(p).mtimeMs);
    } catch {
      /* keep today */
    }
    if (!windowDates.has(day)) continue;

    for (const call of parsed.calls) {
      const modelId = call.model ?? "unknown";
      let cost = 0;
      try {
        cost = pricing.priceCall(call, modelId, undefined, config.pricingOverrides);
      } catch {
        cost = 0;
      }
      byDay.set(day, (byDay.get(day) ?? 0) + cost);
      const label = modelId.replace(/^claude-/, "");
      byModel.set(label, (byModel.get(label) ?? 0) + cost);
      weekTotal += cost;
      if (day === today) todayTotal += cost;
    }
  }

  out("tokenwarden report  (estimates from JSONL — a lower-bound signal)");
  out(`  pricing snapshot: ${pricing.PRICING_TABLE.updated} (${pricing.PRICING_TABLE.source})`);
  out("");
  out(`  today:        ${usd(todayTotal)}`);
  out(`  last 7 days:  ${usd(weekTotal)}`);
  out("");
  out("  by day:");
  const sortedDays = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (!sortedDays.length) out("    (none in window)");
  for (const [day, cost] of sortedDays) {
    out(`    ${day}   ${usd(cost)}`);
  }
  out("");
  out("  by model:");
  const sortedModels = [...byModel.entries()].sort((a, b) => b[1] - a[1]);
  if (!sortedModels.length) out("    (none)");
  for (const [model, cost] of sortedModels) {
    out(`    ${model.padEnd(22)} ${usd(cost)}`);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// inspect (debugging dump)
// ---------------------------------------------------------------------------

export async function inspect(cwd: string = process.cwd()): Promise<number> {
  const config = loadConfig(cwd);

  let pricingUpdated = "(pricing module not built)";
  try {
    const pricing = (await import("./accounting/pricing.js")) as unknown as PricingModule;
    pricingUpdated = `${pricing.PRICING_TABLE.updated} (${pricing.PRICING_TABLE.source})`;
  } catch {
    /* leave placeholder */
  }

  out("tokenwarden inspect");
  out("");
  out(`  state dir:        ${stateDir()}`);
  out(`  ledger path:      ${ledgerPath()}`);
  out(`  pricing snapshot: ${pricingUpdated}`);
  out(`  settings file:    ${resolveSettingsPath({ cwd })}`);
  out("");
  out("  effective config (merged defaults < user < project):");
  for (const line of JSON.stringify(config, null, 2).split("\n")) {
    out("    " + line);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// doctor (health checks; non-zero exit only on FAIL)
// ---------------------------------------------------------------------------

export async function doctor(cwd: string = process.cwd()): Promise<number> {
  let failed = false;
  const pass = (m: string) => out(`  PASS  ${m}`);
  const warn = (m: string) => out(`  WARN  ${m}`);
  const fail = (m: string) => {
    out(`  FAIL  ${m}`);
    failed = true;
  };

  out("tokenwarden doctor");
  out("");

  // node version
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(major) && major >= 18) {
    pass(`node ${process.versions.node} (>= 18)`);
  } else {
    fail(`node ${process.versions.node} is too old; tokenwarden needs >= 18`);
  }

  // settings file
  const settingsPath = resolveSettingsPath({ cwd });
  if (existsSync(settingsPath)) {
    pass(`settings file found: ${settingsPath}`);
  } else {
    warn(`settings file not found: ${settingsPath} (run \`tokenwarden install\`)`);
  }

  // hooks present
  const ins = hooksInstalled(settingsPath);
  if (ins.hooksPresent) {
    pass("tokenwarden hooks are installed");
  } else {
    warn("tokenwarden hooks are not installed (run `tokenwarden install`)");
  }

  // statusLine
  if (ins.statuslineOurs) {
    pass("statusLine is tokenwarden (live cost capture enabled)");
  } else if (ins.statuslinePresent) {
    warn(
      "a non-tokenwarden statusLine is set; budgets rely on it for live cost. " +
        "Set it with: " +
        statuslineHint({ cwd }),
    );
  } else {
    warn("no statusLine set; live cost capture is off (install will offer to set it)");
  }

  // ledger writable
  try {
    const ledger = openLedger();
    ledger.read();
    const probe = join(stateDir(), ".doctor-probe.json");
    writeJsonAtomic(probe, { ok: true, at: Date.now() });
    pass(`ledger directory is writable: ${stateDir()}`);
  } catch {
    fail(`cannot write to state dir: ${stateDir()}`);
  }

  // transcripts found
  try {
    const jsonl = (await import("./accounting/jsonl.js")) as unknown as JsonlModule;
    const n = jsonl.findTranscripts().length;
    if (n > 0) pass(`found ${n} transcript file(s) for reporting`);
    else warn("no transcripts found yet (report will be empty)");
  } catch {
    warn("accounting module not available; skipping transcript check");
  }

  out("");
  out(failed ? "doctor: FAIL — see above." : "doctor: all critical checks passed.");
  return failed ? 1 : 0;
}

// ---------------------------------------------------------------------------
// init (write starter .tokenwarden.json)
// ---------------------------------------------------------------------------

const STARTER_CONFIG = `{
  "// note": "tokenwarden config. All $ figures are USD. Delete keys to use defaults.",
  "// mode": "observe = log what WOULD block (safe). enforce = actually block.",
  "mode": "observe",

  "// budgets": "USD caps; null = no cap. v0.1 enforces dollar caps only.",
  "budgets": {
    "session": { "usd": 5 },
    "daily": { "usd": 25 },
    "project": { "usd": null },
    "// perModel": "cap by model-id substring, e.g. { \\"opus\\": { \\"usd\\": 10 } }",
    "perModel": {}
  },

  "// subscription": "flat-fee plan usage windows (Pro/Max). plan:null = OFF (use $ budgets).",
  "// subscription.plan": "null | \\"pro\\" | \\"max5x\\" | \\"max20x\\" | \\"custom\\"",
  "// subscription.windows": "API-equivalent USD ceilings; null = built-in ESTIMATE for the plan. Calibrate to your own throttling.",
  "subscription": {
    "plan": null,
    "fiveHour": { "usd": null },
    "weekly": { "usd": null }
  },

  "compaction": {
    "// coachAtPercent": "nudge to /compact at this context %",
    "coachAtPercent": 80,
    "// vetoAutoBelowPercent": "veto wasteful auto-compaction below this %",
    "vetoAutoBelowPercent": 50
  },

  "escalation": {
    "enabled": true,
    "expensiveModels": ["opus"],
    "// trivialThresholdUsd": "calls cheaper than this pass silently",
    "trivialThresholdUsd": 0.5
  },

  "bloat": {
    "// readMaxLines": "cap Read.limit to avoid dumping huge files into context",
    "readMaxLines": 2000,
    "refuseUnscopedSearch": true,
    "bashMaxTimeoutMs": 600000
  },

  "// pricingOverrides": "negotiated per-MTok rates keyed by model id",
  "pricingOverrides": {}
}
`;

export function init(cwd: string = process.cwd(), force = false): number {
  const path = projectConfigPath(cwd);
  if (existsSync(path) && !force) {
    out(`init: ${path} already exists. Use --force to overwrite.`);
    return 1;
  }
  // Write the commented starter verbatim (not via writeJsonAtomic, which would
  // strip the comment keys' formatting — we want the human-readable template).
  writeFileSync(path, STARTER_CONFIG, "utf8");
  out(`init: wrote starter config to ${path}`);
  out("  mode is \"observe\" — tokenwarden will log what it WOULD block, not block.");
  out("  Set \"mode\": \"enforce\" when you're ready to enforce budgets.");
  return 0;
}

// ---------------------------------------------------------------------------
// version
// ---------------------------------------------------------------------------

export function readVersion(): string {
  // package.json sits one level above dist/ (and above src/ in dev).
  const here = fileURLToPath(import.meta.url);
  const candidates = [
    join(here, "..", "..", "package.json"), // dist/cli.js -> ../package.json ; src/commands.ts -> ../package.json
    join(here, "..", "..", "..", "package.json"),
  ];
  for (const c of candidates) {
    const pkg = readJsonSafe<{ version?: string }>(c, {});
    if (pkg.version) return pkg.version;
  }
  return "0.1.0";
}
