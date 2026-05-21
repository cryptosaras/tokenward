# tokenwarden — Research Findings

**Compiled:** 2026-05-21
**Method:** Four parallel research agents — (A) Claude Code hooks system, (B) MCP server + compaction/context internals, (C) token-data sources, competitors & pricing, (D) market validation & launch strategy. Sources are official Claude Code / Anthropic docs, the live `@modelcontextprotocol` SDK, the `ccusage` source & issue tracker, a **real Claude Code transcript read on this machine**, and verified 2026 market reporting.
**Companion:** see `PLAN.md` for the resulting implementation plan.

> **Confidence legend:** ✅ verified against a primary source · ⚠️ plausible but version-dependent / single-source · ❌ disproven / infeasible.

---

## 0. Executive summary

1. The viral 2026 dev-tool surface rewards **small, single-purpose, agent-friendly tools** (CLI / MCP / skill), not frameworks. `ccusage` is the de-facto baseline for Claude Code cost visibility — but it is **strictly read-only**. Nothing in the ecosystem **acts** on cost via hooks. That gap is tokenwarden's reason to exist.
2. **Three of the original spec's features are technically impossible** (auto-`/compact`, silent model downgrade, retroactive context pruning). Each has an honest, feasible replacement. See §1.4.
3. **Token-cost pain is real and acute in 2026**, and the sharpest version is *runaway / unattended agent spend*, not generic "Claude is expensive." See §4.
4. The data tokenwarden would enforce on (JSONL `usage`) is **known-unreliable**; live status-line JSON is the better hard-cap signal. See §3.4.
5. A flat **"60–80% savings" headline is indefensible**; a scoped, reproducible benchmark is mandatory before launch. See §4.3.

---

## 1. Claude Code hooks system (Agent A)

> ⚠️ **Provenance caveat:** Agent A returned an unusually high-detail enumeration (27 events, exact per-event timeout tables, output field names). The conceptual model is corroborated by Agents B and C, but the precise schemas have a high precision-to-source ratio. **Treat the exact field names below as a draft to re-verify against `code.claude.com/docs/en/hooks` before writing any hook script** (this is the §9 gate in PLAN.md).

### 1.1 Hook events relevant to tokenwarden
| Event | Fires | Can block? | tokenwarden use |
|---|---|---|---|
| `SessionStart` | session begins/resumes | no (injects context) | capture active model |
| `UserPromptSubmit` | user submits a prompt | ✅ (exit 2 / `decision:block`) | budget gate + compaction coach |
| `PreToolUse` | after tool params built, before exec | ✅ (`permissionDecision`) | budget gate, escalation, arg-bloat cap |
| `PostToolUse` | tool succeeded | partial (can't undo) | accounting only |
| `PreCompact` | before compaction (auto/manual matcher) | ✅ | veto wasteful auto-compaction |
| `Stop` | turn finishes | ✅ | exposes per-turn `tokens_used`; finalize ledger |
| `SessionEnd` | session terminates | no | reconcile session totals; gets `transcript_path` |

### 1.2 PreToolUse input (stdin) — ⚠️ draft schema
```json
{
  "session_id": "…", "transcript_path": "/…/<id>.jsonl", "cwd": "/…",
  "permission_mode": "default|plan|acceptEdits|auto|bypassPermissions",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash|Edit|Write|Read|Glob|Grep|WebFetch|WebSearch|Agent|mcp__server__tool",
  "tool_input": { "...": "tool-specific (e.g. Bash: command, timeout, run_in_background)" },
  "tool_use_id": "…"
}
```

### 1.3 Hook output contract — ⚠️ draft schema
- **Exit 0:** parse stdout JSON for a decision; no JSON ⇒ proceed.
- **Exit 2:** **block**; stderr is shown to Claude as feedback (model adjusts).
- **Other:** non-blocking error; first stderr line surfaced; continue.
- PreToolUse JSON: `hookSpecificOutput.permissionDecision` ∈ `allow|deny|ask`, `permissionDecisionReason`, `modifiedInput` (rewrite tool args), `additionalContext` (inject text). Also top-level `continue`, `stopReason`, `systemMessage`.
- A hook returning `allow` **cannot** override a `deny` rule from settings — hooks can tighten, not loosen.

### 1.4 Verified impossibilities (the critical findings)
- ❌ **Hooks cannot trigger commands** — no programmatic `/compact`, `/model`, `/clear`. `PreCompact` only fires *during* compaction and can only **block** it.
- ❌ **No model-selection control** — model name isn't reliably in hook input; cannot silently downgrade. Only deny + ask.
- ❌ **Hooks cannot modify conversation history** — cannot retroactively prune stale `tool_result` blocks. Can only *prevent* future bloat (via `modifiedInput`) or *block*.

### 1.5 Operational constraints
- Hooks run **synchronously** and stall the turn; `PreToolUse`/`PostToolUse` are high-volume. Keep hot-path hooks **< 100 ms** and **fail open** (errors ⇒ exit 0).
- settings.json scopes (precedence high→low): managed/org → `.claude/settings.local.json` → `.claude/settings.json` → `~/.claude/settings.json`. Matchers are exact / `A|B` / regex.

**Sources:** `code.claude.com/docs/en/hooks`, `/hooks-guide`, `/settings`, `/security` (verified 2026-05-21).

---

## 2. MCP server + compaction internals (Agent B)

### 2.1 MCP server (TypeScript) — for the v0.2 surface
- `@modelcontextprotocol/sdk`: `McpServer` + `StdioServerTransport`; register tools with Zod input schemas and resources with a URI (e.g. `tokenwarden://current-session`).
- Add locally: `claude mcp add --scope project --transport stdio tokenwarden -- node /path/dist/server.js`, or a `.mcp.json` `mcpServers` entry.
- ⚠️ **stdio is best for a co-located local tool** (no network overhead). SSE is deprecated; Streamable HTTP is for cloud services.
- Planned surface: `tokenwarden_inspect` (return live token/cost snapshot), `tokenwarden_compact` (estimate freed tokens — note it can only *estimate/advise*, not trigger), resource `tokenwarden://current-session`.

### 2.2 Compaction & context
- `/compact` summarizes history near the context limit; auto-compact triggers around a high-fill threshold (⚠️ exact % version-dependent; reported tunable via env override). Multiple field reports say auto-compact fires early and wastefully — justifies the **veto** primitive.
- `/context` and `/usage` are user-facing; **no documented programmatic JSON export** of `/usage`.

### 2.3 Status-line JSON — the reliable live signal
Claude Code pipes JSON to the configured status-line command. ⚠️ Field names version-dependent; reported shape:
```json
{ "context_window": { "context_window_size": 200000, "used_percentage": 8.0,
    "current_usage": { "input_tokens": …, "output_tokens": …,
      "cache_creation_input_tokens": …, "cache_read_input_tokens": … } },
  "cost": { "total_cost_usd": 0.0123 },
  "model": { "id": "claude-opus-4-7", "display_name": "Opus" },
  "session_id": "…", "exceeds_200k_tokens": false }
```
This is **more reliable than JSONL** for live hard caps (see §3.4).

### 2.4 Tool Search / lazy loading (April 2026)
MCP tool schemas are deferred; only names load up front (~120 tokens), full schema fetched on demand. No special server action required, but a concise server-instructions string improves discovery. Reduces MCP context injection ~80–90%.

**Sources:** `code.claude.com/docs/en/mcp`, `/context-window`, `/statusline`, `/costs`; `github.com/modelcontextprotocol/typescript-sdk`.

---

## 3. Token data, competitors & pricing (Agent C — most grounded; read a real transcript)

### 3.1 Transcript storage — ✅ verified on this machine
- Path: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. Example here: `C:\Users\narij\.claude\projects\E--A-develop-Github-tokenwarden\<uuid>.jsonl`.
- **Folder encoding:** `cwd.replace(/[^A-Za-z0-9]/g, '-')` — **lossy** (a `:` then `\` → `--`; `_` → `-`; `.` → `-`). To recover the true path, read the `cwd` field inside a line, not the folder name.
- Also probe `~/.config/claude/projects/` and honor `CLAUDE_CONFIG_DIR` (comma-separated), like ccusage.

### 3.2 JSONL line schema — ✅ verified
- One JSON object per line, discriminated by `type` (`assistant`, `user`, `attachment`, `permission-mode`, `file-history-snapshot`, …).
- **Token usage is only on `type:"assistant"` lines**, under `message.usage`:
  - `input_tokens`, `output_tokens`, `cache_read_input_tokens`
  - `cache_creation_input_tokens` — **split** via `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` (bill differently)
  - `server_tool_use.web_search_requests` (billed $10/1k), `service_tier`, `inference_geo`
- Tool call = `tool_use` block in an assistant message; result = `tool_result` block in the next user message (linked by `tool_use_id`).
- **`isSidechain:true`** marks Task-tool subagent messages → **per PLAN.md decision, these count toward the parent budget.**
- **Dedup by `requestId`** (one API call → 2–10 lines). **Do not sum `usage.iterations[]`** (duplicates totals).

### 3.3 ccusage architecture (the baseline competitor) — ✅
- npm `ccusage`; `npx ccusage@latest`. Reads local JSONL only (no network on core path). Dedups by `requestId`. Aggregates daily/weekly/monthly/session/5h-block. Tokens→cost via a LiteLLM pricing dataset, with an offline embedded snapshot. **Strictly read-only reporting — its own README says it "does not modify agent behavior."** Only Claude Code touchpoint is a passive statusline. **This is exactly tokenwarden's gap to fill.**

### 3.3b Competitor landscape — ✅
| Tool | Does | Leaves open |
|---|---|---|
| ccusage | cost reports + statusline | read-only |
| Claude-Code-Usage-Monitor | live burn-rate / predictions | warns, doesn't act |
| ccflare, ccstatusline, claude-code-usage-bar | dashboards / statuslines | display only |
| cc-budget | budget *alerts* | alerts, not blocking |
| Anthropic Console spend limits | hard server-side caps | org/workspace only; no per-session/tool/model, no auto-action |

**Net: every Claude-Code-specific tool is observe-only or alert-only. None binds spend to hooks to deterministically refuse/modify actions.**

### 3.4 Data-quality caveat — ⚠️ critical
ccusage **issue #866**: Claude Code writes `usage` from early streaming events and never updates to finals; input undercounted up to 100–174×, output up to 10–17× in some cases. **Any enforcement tool inherits this.** Mitigation: dedup by `requestId`, treat JSONL as *signal / lower bound* for reporting, and use the **status-line cumulative/rate-limit JSON for hard caps**.

### 3.5 Pricing table — ✅ verified (platform.claude.com, per MTok USD)
| Model | Base in | 5m write | 1h write | Cache read | Output |
|---|---|---|---|---|---|
| Opus 4.7 / 4.6 / 4.5 | $5 | $6.25 | $10 | $0.50 | $25 |
| Opus 4.1 | $15 | $18.75 | $30 | $1.50 | $75 |
| Sonnet 4.6 / 4.5 | $3 | $3.75 | $6 | $0.30 | $15 |
| Haiku 4.5 | $1 | $1.25 | $2 | $0.10 | $5 |

**Multiplier rule (use instead of hardcoding):** 5m write = 1.25× base in · 1h write = 2× base in · cache read = 0.1× base in.
**Gotchas to bake in:** Opus 4.7 tokenizer can use **~35% more tokens** for the same text; `inference_geo:"us"` = 1.1×; Fast mode = 6×; Batch = 0.5×; web search = $10/1k. Ship a versioned snapshot with a visible "pricing updated [date]" line; allow negotiated-rate overrides; always label dollar figures **estimates**.

### 3.6 Feasible deterministic actions — ✅ / ❌
| Action | Mechanism | Verdict |
|---|---|---|
| Block a tool call over budget | `PreToolUse` deny / exit 2 | ✅ |
| Cap/rewrite tool args (Read.limit, WebFetch, Grep) | `PreToolUse` `modifiedInput` | ✅ (closest legal "prune") |
| Per-day/project/session budget cap | block when cached aggregate ≥ cap | ✅ (read must be O(1)) |
| Block prompt over budget + nudge `/compact` | `UserPromptSubmit` block + `additionalContext` | ✅ |
| Rate-limit ($/hr, calls/min) | sliding window | ✅ |
| Gate subagent loop | `Stop` / `SubagentStop` block | ✅ |
| Veto runaway compaction | `PreCompact` block | ✅ |
| **Trigger `/compact`** | — | ❌ impossible |
| **Silent model downgrade** | — | ❌ impossible |
| **Prune existing context** | — | ❌ impossible |

**Sources:** real local transcript; `github.com/ryoppippi/ccusage` (+ issue #866); `platform.claude.com/docs/en/about-claude/pricing`; `code.claude.com/docs/en/hooks`.

---

## 4. Market validation & launch (Agent D)

### 4.1 Demand — ✅ cost pain is real; sharpest as *runaway spend*
Verified anecdotes (use these):
- **Uber** burned its **entire 2026 AI budget by April** (4 months) on Claude Code (briefs.co). ✅
- **$47k in 3 days** from 23 unattended subagents (aicosts.ai). ⚠️ single secondary source — present as "reported."
- One `/typescript-checks` spun up **49 subagents, 887K tokens/min, ~$8–15k/session** (aicosts.ai). ⚠️ reported estimate.
- Indie maker **Jenny Ouyang's surprise $1,600 bill** from invisible context accumulation (buildtolaunch.substack.com). ✅ named individual.
- Anthropic docs baseline: ~**$13/dev/active-day, $150–250/dev/month** (code.claude.com/docs/costs). ✅
- ❌ **The source brief's "$87k/35-eng" and "$4,200/3-days" could NOT be verified — do not cite.**

Framing: lead with *"I had no guardrail and woke up to a $X bill,"* not generic price complaints.

### 4.2 Wedge vs ccusage — ✅
> **ccusage tells you what you spent. tokenwarden stops you from overspending** — enforces budgets, escalates expensive calls, prevents arg-bloat, coaches compaction.

Frame as **complementary** ("track with ccusage, enforce with tokenwarden") to invite a cross-link from ryoppippi's audience rather than rivalry.

### 4.3 Benchmark — ✅ methodology, ❌ the "60–80%" headline
No controlled benchmark supports a flat 60–80%. Real measured points: a TDD/workflow plugin A/B showed ~9% cheaper / 14% fewer tokens; MCP-context plugins 50–90% **only** in tool-heavy sessions; "70%" claims usually bundle multiple skills. **Honest options:** *"30–50% on typical sessions"* · *"up to 70% on MCP-heavy/long-running sessions"* · pain-tied *"caps runaway sessions before they cost $1,000s."* Ship `benchmarks/` (N≥6 with/without, same model & prompts, pinned CC version, measure from JSONL, report median+range, publish raw logs) **before** the launch tweet.

### 4.4 Risks & mitigations — ✅
- **Anthropic absorbs it:** native controls are all manual/advisory/org-level; no per-dev/per-project hard cap or auto-downgrade. Position there; if they ship hard budgets, pivot to multi-CLI (Codex/Gemini/Amp) coverage.
- **Estimate accuracy:** read the JSONL ccusage trusts, label everything "estimate," version the pricing table, allow rate overrides.
- **Hooks intrusive/breaking:** fail-open, <100 ms, clean `uninstall`, **observe-only first session**.
- **"Blocks models" annoying:** friction scaled to dollar amount, one-keystroke escalation, per-project config.

### 4.5 README & launch — ✅
- README order: tagline → **block-in-action GIF** → `npx tokenwarden install` → quick start → features → how it works → Agent use/MCP → benchmarks → **vs-ccusage comparison table** → MIT → star-history. Topics: `claude-code`, `claude-usage`, `claude-code-hooks`, `mcp`, `cost-optimization`, `cli`, `ai-agents`.
- Sequence: r/ClaudeAI (runaway-bill story) → Show HN +1 day (lead with benchmark, defend in comments) → X ("works alongside ccusage") → directories + awesome-list PRs (`hesreallyhim/awesome-claude-code`, `affaan-m/everything-claude-code`, `punkpeye/awesome-mcp-servers`) → cost-optimization newsletters/creators.

**Sources:** briefs.co (Uber); aicosts.ai; buildtolaunch.substack.com; code.claude.com/docs/costs; finout.io (Opus 4.7 tokenizer/pricing); github.com/ryoppippi/ccusage; claudefa.st (awesome-list roundup).

---

## 5. Consolidated unverified / re-check list

- All exact hook **output** field names & the 27-event list (Agent A) — re-verify at `code.claude.com/docs/en/hooks`.
- Status-line JSON exact field names + version added — re-verify at `/statusline`.
- Auto-compact trigger % and env override — version-dependent.
- ccusage's exact `requestId` dedup implementation (concept ✅, raw constant not read).
- `$47k/3-days` and `887K tokens/min` rest on a single secondary source — label "reported."
- Brief's `$87k/35-eng` and `$4,200/3-days` — **rejected, unverifiable.**
