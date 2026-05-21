#!/usr/bin/env node
/**
 * tokenwarden benchmark harness — zero-dep Node >= 18
 *
 * This harness does NOT drive Claude Code. The operator runs each task prompt
 * manually (or via `claude -p`) and calls this script afterward to record the
 * token measurement. See benchmarks/README.md for the full procedure.
 *
 * Modes:
 *   collect   node benchmarks/run.mjs --label with|without --scenario <id> [--session <id>]
 *   summarize node benchmarks/run.mjs --summarize
 *
 * Each collect run writes results/<timestamp>-<label>-<scenario>.json.
 * --summarize reads all saved samples and prints a markdown comparison table.
 *
 * Data accuracy: JSONL token counts are a lower bound (Claude Code writes usage
 * from early streaming events; ccusage issue #866). Both "with" and "without"
 * samples are measured identically, so relative comparisons are valid.
 */

import { createReadStream, readdirSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Pricing snapshot — inline so the harness stays zero-dependency.
// Pricing updated: 2026-05-21 — source: platform.claude.com
// All USD figures produced here are ESTIMATES.
// Multiplier rules: 5m-cache-write = 1.25x baseInput, 1h = 2x, cache-read = 0.1x
// ---------------------------------------------------------------------------
const PRICING = [
  { match: "opus-4-7", baseInput: 5,  output: 25, cacheRead: 0.50 },
  { match: "opus-4-6", baseInput: 5,  output: 25, cacheRead: 0.50 },
  { match: "opus-4-5", baseInput: 5,  output: 25, cacheRead: 0.50 },
  { match: "opus-4-1", baseInput: 15, output: 75, cacheRead: 1.50 },
  { match: "opus",     baseInput: 5,  output: 25, cacheRead: 0.50 },
  { match: "sonnet",   baseInput: 3,  output: 15, cacheRead: 0.30 },
  { match: "haiku",    baseInput: 1,  output:  5, cacheRead: 0.10 },
];
const WEB_SEARCH_PER_1K = 10;
const MTOK = 1_000_000;

function findPricing(modelId) {
  const id = (modelId ?? "").toLowerCase();
  return PRICING.find(p => id.includes(p.match)) ?? PRICING.find(p => p.match === "sonnet");
}

function estimateCost(u, modelId) {
  const p = findPricing(modelId);
  return (
    (u.inputTokens        / MTOK) * p.baseInput +
    (u.outputTokens       / MTOK) * p.output +
    (u.cacheWrite5mTokens / MTOK) * (p.baseInput * 1.25) +
    (u.cacheWrite1hTokens / MTOK) * (p.baseInput * 2.00) +
    (u.cacheReadTokens    / MTOK) * p.cacheRead +
    (u.webSearchRequests  / 1000) * WEB_SEARCH_PER_1K
  );
}

// ---------------------------------------------------------------------------
// JSONL parsing — verified field paths (RESEARCH §3.2, real transcript)
//   - Usage only on type:"assistant" lines under message.usage
//   - Dedup by requestId (1 API call → 2-10 lines; do NOT sum iterations[])
//   - cache_creation split: ephemeral_5m_input_tokens / ephemeral_1h_input_tokens
// ---------------------------------------------------------------------------
async function parseTranscript(path) {
  const seen = new Set();
  let modelId = "unknown";
  const t = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
              cacheWrite5mTokens: 0, cacheWrite1hTokens: 0, webSearchRequests: 0 };

  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    if (rec.model) modelId = rec.model;
    if (rec.message?.model) modelId = rec.message.model;
    if (rec.type !== "assistant") continue;
    if (!rec.requestId || seen.has(rec.requestId)) continue;
    seen.add(rec.requestId);
    const u = rec.message?.usage;
    if (!u) continue;
    t.inputTokens     += u.input_tokens              ?? 0;
    t.outputTokens    += u.output_tokens             ?? 0;
    t.cacheReadTokens += u.cache_read_input_tokens   ?? 0;
    const cc = u.cache_creation ?? {};
    // Newer transcripts use split tier fields; older use the flat field (treat as 5m)
    if ((cc.ephemeral_5m_input_tokens ?? 0) > 0 || (cc.ephemeral_1h_input_tokens ?? 0) > 0) {
      t.cacheWrite5mTokens += cc.ephemeral_5m_input_tokens ?? 0;
      t.cacheWrite1hTokens += cc.ephemeral_1h_input_tokens ?? 0;
    } else {
      t.cacheWrite5mTokens += u.cache_creation_input_tokens ?? 0;
    }
    t.webSearchRequests += u.server_tool_use?.web_search_requests ?? 0;
  }

  const totalTokens = t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheWrite5mTokens + t.cacheWrite1hTokens;
  return { tokens: t, totalTokens, estUsd: estimateCost(t, modelId), requestCount: seen.size, modelId };
}

// ---------------------------------------------------------------------------
// Locate transcripts — same search order as ccusage
// ---------------------------------------------------------------------------
function claudeProjectDirs() {
  const dirs = [];
  if (process.env.CLAUDE_CONFIG_DIR) {
    process.env.CLAUDE_CONFIG_DIR.split(",").forEach(d => dirs.push(join(d.trim(), "projects")));
  }
  dirs.push(join(homedir(), ".claude", "projects"));
  dirs.push(join(homedir(), ".config", "claude", "projects"));
  return dirs;
}

function findTranscriptSync(sessionId) {
  const candidates = [];
  for (const base of claudeProjectDirs()) {
    let projectDirs; try { projectDirs = readdirSync(base, { withFileTypes: true }); } catch { continue; }
    for (const entry of projectDirs) {
      if (!entry.isDirectory()) continue;
      let files; try { files = readdirSync(join(base, entry.name)); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith(".jsonl")) continue;
        if (sessionId && !f.includes(sessionId)) continue;
        const full = join(base, entry.name, f);
        try { candidates.push({ path: full, mtimeMs: statSync(full).mtimeMs }); } catch { /* skip */ }
      }
    }
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0].path;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// ---------------------------------------------------------------------------
// Results storage
// ---------------------------------------------------------------------------
const RESULTS_DIR = join(__dirname, "results");

function saveResult(label, scenarioId, data) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fp = join(RESULTS_DIR, `${ts}-${label}-${scenarioId}.json`);
  writeFileSync(fp, JSON.stringify({ label, scenarioId, ...data }, null, 2));
  return fp;
}

function loadAllResults() {
  mkdirSync(RESULTS_DIR, { recursive: true });
  return readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith(".json"))
    .flatMap(f => { try { return [JSON.parse(readFileSync(join(RESULTS_DIR, f), "utf8"))]; } catch { return []; } });
}

// ---------------------------------------------------------------------------
// Summarize mode — print a markdown comparison table
// ---------------------------------------------------------------------------
function summarize() {
  const results = loadAllResults();
  if (!results.length) { console.log("No results in benchmarks/results/. Run collect passes first."); return; }

  const byScenario = {};
  for (const r of results) {
    if (!r.scenarioId || !r.label) continue;
    (byScenario[r.scenarioId] ??= { with: [], without: [] })[r.label]?.push(r);
  }
  const ids = Object.keys(byScenario).sort();
  if (!ids.length) { console.log("No valid results to summarize."); return; }

  const fT = v => v == null ? "N/A" : Math.round(v).toLocaleString();
  const fU = v => v == null ? "N/A" : "$" + v.toFixed(4);

  const lines = [
    "## tokenwarden benchmark results\n",
    "Pricing snapshot: 2026-05-21. All USD figures are ESTIMATES.",
    "Token counts are a lower bound (JSONL undercounting; ccusage issue #866).",
    "Relative deltas (with vs without) are valid; absolute numbers are underestimates.\n",
    "| Scenario | Without tokens (median, range) | With tokens (median, range) | Delta | Without USD | With USD | Runs |",
    "|---|---|---|---|---|---|---|",
  ];

  for (const sid of ids) {
    const g = byScenario[sid];
    const woT = g.without.map(r => r.totalTokens).filter(Number.isFinite);
    const wiT = g.with   .map(r => r.totalTokens).filter(Number.isFinite);
    const woU = g.without.map(r => r.estUsd)     .filter(Number.isFinite);
    const wiU = g.with   .map(r => r.estUsd)     .filter(Number.isFinite);

    const woMed = median(woT), wiMed = median(wiT);
    const delta = (woMed != null && wiMed != null && woMed > 0)
      ? (((woMed - wiMed) / woMed) * 100).toFixed(1) + "% fewer" : "N/A";
    const range = arr => arr.length >= 2 ? ` (${fT(Math.min(...arr))}–${fT(Math.max(...arr))})` : "";

    lines.push(`| ${sid} | ${fT(woMed)}${range(woT)} | ${fT(wiMed)}${range(wiT)} | ${delta} | ${fU(median(woU))} | ${fU(median(wiU))} | ${g.without.length}w/${g.with.length}t |`);
  }

  console.log(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Collect mode
// ---------------------------------------------------------------------------
async function collect(label, scenarioId, sessionId) {
  if (!["with", "without"].includes(label)) {
    console.error('--label must be "with" or "without"'); process.exit(1);
  }
  if (!scenarioId) { console.error("--scenario <id> required"); process.exit(1); }

  const tp = findTranscriptSync(sessionId ?? null);
  if (!tp) {
    console.error("No JSONL transcript found. Complete a Claude Code session first.");
    console.error("Searched:", claudeProjectDirs().join(", "));
    process.exit(1);
  }

  console.log(`Parsing: ${tp}`);
  const r = await parseTranscript(tp);
  const saved = saveResult(label, scenarioId, {
    transcriptPath: tp, sessionId: sessionId ?? "auto-latest",
    measuredAt: new Date().toISOString(), pricingUpdated: "2026-05-21",
    modelId: r.modelId, totalTokens: r.totalTokens, estUsd: r.estUsd,
    requestCount: r.requestCount, tokens: r.tokens,
  });

  console.log(`\nScenario : ${scenarioId}  |  Label: ${label}  |  Model: ${r.modelId}`);
  console.log(`Tokens   : ${r.totalTokens.toLocaleString()} (lower bound — JSONL undercounting)`);
  console.log(`Est. USD : $${r.estUsd.toFixed(4)} (estimate only)`);
  console.log(`API calls: ${r.requestCount}`);
  console.log(`Saved    : ${saved}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { label: null, scenario: null, session: null, summarize: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--label")     a.label     = argv[++i];
    else if (argv[i] === "--scenario") a.scenario  = argv[++i];
    else if (argv[i] === "--session")  a.session   = argv[++i];
    else if (argv[i] === "--summarize") a.summarize = true;
    else if (argv[i] === "--help")     a.help      = true;
  }
  return a;
}

function printHelp() {
  console.log(`
tokenwarden benchmark harness — does NOT drive Claude Code; see benchmarks/README.md

USAGE
  node benchmarks/run.mjs --label with|without --scenario <id> [--session <id>]
  node benchmarks/run.mjs --summarize

OPTIONS
  --label with|without  Whether tokenwarden was enforcing during this run
  --scenario <id>       Scenario id from scenarios.json
  --session <id>        Specific session id (defaults to most recent .jsonl)
  --summarize           Print markdown table of all collected results
  --help                Show this message
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || (!args.summarize && !args.label && !args.scenario)) printHelp();
else if (args.summarize) summarize();
else await collect(args.label, args.scenario, args.session);
