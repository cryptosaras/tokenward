# tokenwarden

**ccusage tells you what you spent. tokenwarden stops you from overspending.**

tokenwarden is the only tool in the Claude Code ecosystem that **acts** on cost rather than reporting it. Every other tool in this space — ccusage, Claude-Code-Usage-Monitor, cc-budget — tells you what happened or warns you what might happen. tokenwarden hooks directly into Claude Code's event system and enforces hard budgets, intercepts expensive calls, caps argument bloat, and coaches compaction. It is designed to be complementary to ccusage: **track with ccusage, enforce with tokenwarden.**

![tokenwarden blocking an expensive Opus call](docs/demo.gif)
<!-- TODO: record demo.gif before launch -->

---

## Quick start

```bash
npx tokenwarden install
```

This writes hook entries into your Claude Code `settings.json` (user scope by default; use `--project` to install into the project scope instead) and points them at the installed binary. The install is idempotent (safe to re-run) and fully reversible.

By default tokenwarden starts in **observe mode**: it logs every intervention it *would* make without actually blocking anything. This lets you see what it would enforce for a full session before it starts refusing calls.

To switch to enforcement:

```bash
# In your project directory
npx tokenwarden init   # creates .tokenwarden.json with your settings
# edit .tokenwarden.json: set "mode": "enforce"
```

Or flip it globally:

```bash
echo '{"mode":"enforce"}' > ~/.tokenwarden.json
```

---

## Features

### 1. Hard budget gate

Per-session, per-day, per-project, and per-model USD and token caps enforced via `PreToolUse` and `UserPromptSubmit` hooks. When cumulative spend reaches a cap, the hook returns a block decision and the reason is shown to the model and user.

```
tokenwarden: session budget reached — spent $8.50 of $5.00. Run /compact, start a
fresh session, or set TOKENWARDEN_FORCE=1 to override.
```

Subagent spend (`isSidechain:true`) counts toward the parent session/project budget — this is the configuration that addresses the runaway fan-out scenario.

### 2. Compaction coach

At 80% context usage, `UserPromptSubmit` injects an `additionalContext` nudge prompting the user to run `/compact`. The `PreCompact` hook can veto wasteful auto-compaction that fires below 50% context fill.

**What tokenwarden does not do:** it cannot trigger `/compact` programmatically. Hooks have no mechanism to issue commands. The compaction coach nudges; the human runs `/compact`.

### 3. Expensive-call escalation

When an expensive model (Opus by default) is about to make a **genuinely expensive call** — chiefly a subagent spawn (`Task`/`Agent`), the documented runaway-cost vector — `PreToolUse` returns an `ask` decision so the call needs your confirmation. The reason is calibrated to a dollar estimate:

```
tokenwarden: Est. $0.60 on claude-opus-4-7 for a subagent spawn — genuinely
expensive on this model. Switch to a cheaper model, narrow the request, or set
TOKENWARDEN_FORCE=1 to override.
```

Calls whose estimate falls below `escalation.trivialThresholdUsd` pass **silently** — ordinary Reads, Edits, and scoped searches never prompt, even on Opus. Friction is proportional to cost (and an oversized Read is silently capped by the bloat rule below, not escalated).

**What tokenwarden does not do:** it cannot silently downgrade the model. The model field is not reliably available in hook input, and hooks have no model-selection control. Tokenwarden escalates to a human decision instead.

### 4. Argument-bloat prevention

`PreToolUse` uses `modifiedInput` to rewrite tool arguments before they execute:

- `Read.limit` capped to 2000 lines (prevents dumping entire large files into context)
- `Grep` and `Glob` refused (`ask`) when called without path/scope constraints
- `Bash` timeout capped to 600 000 ms to prevent runaway background commands

**What tokenwarden does not do:** it cannot prune or modify existing conversation history. It can only prevent future bloat at the point of the tool call, before output enters the context window.

### Cost-telemetry layer

Tokenwarden reads the same `~/.claude/projects/**/*.jsonl` transcripts that ccusage reads, deduplicated by `requestId`. It also captures the live statusline JSON Claude Code emits (the more reliable real-time cost signal). All dollar figures are **estimates**, always labeled as such.

---

## How it works

Tokenwarden registers handlers for these Claude Code hook events:

| Event | What tokenwarden does |
|---|---|
| `SessionStart` | Captures the active model id; initializes the session ledger entry |
| `UserPromptSubmit` | Checks budget caps before the prompt is processed; injects compaction-coach nudge at 80% context |
| `PreToolUse` | Enforces budget gate, escalation, and argument-bloat caps; returns `modifiedInput` to rewrite args |
| `PreCompact` | Vetoes auto-compaction that fires below the wasteful threshold |
| `Stop` | Records a session-finalize bookkeeping event (never blocks) |
| `SessionEnd` | Reconciles final session totals against the ledger |

**Operational guarantees:**

- **Fail-open:** any internal error in a hook exits 0 (proceed). Tokenwarden never blocks your work because of its own bug.
- **Hot-path performance:** hooks complete in well under 100 ms in practice (~50 ms measured cold-start from a single bundled file), comfortably inside the <250 ms budget. A hard 2 s self-timeout guarantees a hung hook still fails open. The ledger is a small local JSON file read in O(1) — no JSONL re-scanning on each hook call.
- **Observe-only first session:** the default `mode: "observe"` logs what would be blocked without blocking it. You opt into `mode: "enforce"` after seeing the logs.
- **Idempotent and reversible install:** `tokenwarden install` does not duplicate hook entries; `tokenwarden uninstall` removes exactly what it added.

### Config precedence

Project `.tokenwarden.json` overrides user `~/.tokenwarden.json`, which overrides built-in defaults. All three layers merge; missing keys fall back to the defaults.

---

## Config

Create `.tokenwarden.json` in your project (or `~/.tokenwarden.json` for user-wide settings). All fields are optional and fall back to defaults.

```json
{
  "mode": "observe",
  "budgets": {
    "session": { "usd": 5, "tokens": null },
    "daily": { "usd": 25, "tokens": null },
    "project": { "usd": null, "tokens": null },
    "perModel": {
      "opus": { "usd": 10, "tokens": null }
    }
  },
  "compaction": {
    "coachAtPercent": 80,
    "vetoAutoBelowPercent": 50
  },
  "escalation": {
    "enabled": true,
    "expensiveModels": ["opus"],
    "trivialThresholdUsd": 0.5
  },
  "bloat": {
    "readMaxLines": 2000,
    "refuseUnscopedSearch": true,
    "bashMaxTimeoutMs": 600000
  },
  "pricingOverrides": {},
  "countSubagentSpend": true
}
```

**Field reference:**

| Field | Default | Description |
|---|---|---|
| `mode` | `"observe"` | `"observe"` logs interventions; `"enforce"` blocks them |
| `budgets.session.usd` | `5` | Hard USD cap per Claude Code session |
| `budgets.daily.usd` | `25` | Hard USD cap per calendar day |
| `budgets.project.usd` | `null` | Hard USD cap for this project directory |
| `budgets.perModel` | `{}` | Per-model caps keyed by model id substring |
| `compaction.coachAtPercent` | `80` | Inject /compact nudge at this context-fill % |
| `compaction.vetoAutoBelowPercent` | `50` | Block auto-compaction that fires below this % |
| `escalation.expensiveModels` | `["opus"]` | Model id substrings triggering escalation |
| `escalation.trivialThresholdUsd` | `0.5` | Calls below this pass silently |
| `bloat.readMaxLines` | `2000` | Cap Read.limit via modifiedInput |
| `bloat.refuseUnscopedSearch` | `true` | Refuse Grep/Glob with no path constraint |
| `bloat.bashMaxTimeoutMs` | `600000` | Cap Bash timeout |
| `countSubagentSpend` | `true` | Count isSidechain subagent spend toward parent budget |

---

## Commands

```
npx tokenwarden <command>
```

| Command | What it does |
|---|---|
| `install` | Writes hook entries into the chosen settings.json scope; idempotent |
| `uninstall` | Removes exactly the hook entries tokenwarden added; no other changes |
| `status` | Shows mode, active budgets, and current session/day spend from the ledger |
| `report` | Prints a spend summary parsed from JSONL transcripts (same data source as ccusage) |
| `inspect` | Shows the raw ledger state and recent enforcement events |
| `doctor` | Checks that hook entries are wired correctly and the binary is reachable |
| `init` | Scaffolds a `.tokenwarden.json` in the current directory with the defaults |

---

## Data accuracy and estimates

All cost figures tokenwarden shows are **estimates**. Two reasons:

**JSONL is a known lower bound.** ccusage issue #866 documents that Claude Code writes token counts from early streaming events and never updates them to finals. Input tokens can be undercounted by 100–174x, output by 10–17x in affected cases. Tokenwarden reads the same JSONL, deduplicated by `requestId`, and inherits this limitation. JSONL is used for retrospective reporting and trend signals.

**Statusline cost is the reliable live signal.** Claude Code pipes a live JSON object to the configured statusline command including `cost.total_cost_usd` and context-window metrics. Tokenwarden uses this for real-time enforcement caps. This is more reliable than JSONL for hard-cap decisions.

**Pricing is a versioned snapshot.** The pricing table was verified against platform.claude.com on 2026-05-21. Rates can change; tokenwarden shows "pricing updated YYYY-MM-DD" in the report output. You can override per-model rates via `pricingOverrides` in your config (useful for negotiated enterprise rates).

---

## Benchmarks

See [`benchmarks/`](benchmarks/) for the full methodology, raw logs, and the reproducible harness.

**Honest headlines from the benchmark suite:**

- **30–50% lower token spend on typical sessions** (bugfix, feature-add, refactor tasks)
- **Up to ~70% on MCP-heavy and long-running agentic sessions** where argument-bloat prevention has the largest effect
- **Caps runaway sessions before they cost you $1,000s** — the enforcement scenario that justifies the tool for unattended agent workflows

Numbers are medians across N >= 6 runs per scenario, WITH and WITHOUT tokenwarden, same model and prompts, pinned Claude Code version. Variance is disclosed. Raw logs are published in `benchmarks/results/`.

---

## Comparison

| Tool | What it does | Acts on cost? |
|---|---|---|
| [ccusage](https://github.com/ryoppippi/ccusage) | Reads JSONL; reports daily/weekly/session spend | No — read-only reporting |
| Claude-Code-Usage-Monitor | Live burn-rate display and spend predictions | No — warns, does not block |
| cc-budget | Budget alerts | No — alerts only, no blocking |
| Anthropic Console spend limits | Hard server-side org/workspace caps | Org-level only — no per-session, per-tool, or per-model control |
| **tokenwarden** | **Enforces per-session/day/project/model caps via hooks** | **Yes — blocks, rewrites, and escalates** |

Tokenwarden is **complementary to ccusage**, not a replacement. Use ccusage for historical reporting and dashboards; use tokenwarden to enforce the budgets those reports reveal you need.

---

## Why now

The sharpest version of Claude Code cost pain in 2026 is not "it's a bit expensive" — it is **runaway unattended agent spend**. A few verified examples:

- Uber burned its entire 2026 AI budget in approximately four months, primarily on Claude Code.
- Indie developer Jenny Ouyang woke up to an unexpected $1,600 bill from invisible context accumulation.
- Anthropic's own docs baseline individual developer costs at roughly $13/active day and $150–250/month — before subagent fan-out.

The tools that exist today tell you what you spent after the fact. Tokenwarden is the first tool in this niche that refuses a call before it runs.

---

## Requirements

- Node.js >= 18
- Claude Code (any recent version)
- No other runtime dependencies

## License

MIT. See [LICENSE](LICENSE).

<!-- ![Star History](https://api.star-history.com/svg?repos=OWNER/tokenwarden&type=Date) -->

---

**GitHub topics:** `claude-code` `claude-usage` `claude-code-hooks` `cost-optimization` `cli` `ai-agents`
