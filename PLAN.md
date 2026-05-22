# tokenwarden — Implementation Plan

> A token-budget **enforcer** for Claude Code. ccusage tells you what you spent; tokenwarden stops you from overspending — it enforces budgets, escalates expensive calls to a one-keystroke decision, prevents tool-argument bloat, and coaches compaction.

Plan compiled 2026-05-21 from four parallel research passes (Claude Code hooks, MCP/compaction internals, token-data sources & competitors, market/launch). This document is the source of truth for scope. **Current deliverable is documentation only — no code.** The two artifacts are this `PLAN.md` and the companion `RESEARCH.md` (full findings + citations). Implementation is deferred until explicitly requested.

---

## 1. Critical reality check — what the original spec got wrong

The source brief (idea #01) specced: *"Auto-injects `/compact` prompts, blocks expensive models for trivial calls, prunes stale tool output."* Research against the **live 2026 Claude Code docs and a real on-disk transcript** shows three of those are **technically impossible as written**:

| Original feature | Reality | Honest replacement |
|---|---|---|
| Auto-inject `/compact` | ❌ Hooks **cannot trigger commands**. `PreCompact` only fires *during* compaction and can only **block** it. | **Compaction coach** — nudge the human to run `/compact` via `additionalContext`; veto wasteful auto-compaction. |
| Block expensive models / silent downgrade | ❌ No model-selection control in hooks; model name not reliably in hook input. | **One-keystroke escalation** — `PreToolUse` deny + reason ("looks Sonnet-class; switch model or `TOKENWARDEN_FORCE=1`"), friction scaled to dollar amount. |
| Prune stale `tool_result` from context | ❌ Hooks **cannot modify conversation history**. | **Argument-bloat prevention** — `modifiedInput` caps `Read.limit`, truncates `WebFetch`, refuses unscoped `Grep`/`Glob` *before* output enters context. |

**The headline "60–80% savings" is indefensible** and will get torn apart in the Show HN top comment. No controlled benchmark supports a flat number from one install. Use the scoped, reproducible range in §7.

**The JSONL token data is known-unreliable** (ccusage issue #866: streaming-event values never updated to finals; input undercounted up to 100–174×). Treat JSONL as *signal/lower-bound*, not ground truth. For hard caps, prefer the **status-line JSON** Claude Code emits live.

> What's left after subtracting the impossible is still a real, differentiated tool — the *only* one in this niche that **acts** instead of reporting.

---

## 2. Product definition (reframed)

**One-sentence wedge:** *ccusage tells you what you spent. tokenwarden stops you from overspending.*

**Four feasible primitives** (all inside the verified hook envelope):

1. **Hard budget gate** — per-session / per-day / per-project / per-model dollar & token caps. Enforced via `PreToolUse` (and/or `UserPromptSubmit`) returning a block decision; the reason string is read by the model and shown to the user.
2. **Compaction coach** — `UserPromptSubmit` injects a nudge ("at 80% of context budget — consider `/compact`"); `PreCompact` can veto runaway/wasteful auto-compaction. Never claim "auto-compact."
3. **Expensive-call escalation** — when an expensive model is paired with a trivial action, deny with a one-keystroke escalation calibrated to the estimated dollar amount. Cheap actions pass silently.
4. **Argument-bloat prevention** — `modifiedInput` on `PreToolUse` caps/rewrites tool inputs that would dump huge output into context (`Read.limit`, `WebFetch`, unscoped `Grep`/`Glob`, runaway `Bash`).
5. **Subscription usage windows** *(added 2026-05-22)* — flat-fee plans (Pro / Max 5x / Max 20x) don't bill by the dollar; they throttle on a rolling **5-hour** and **7-day** window. tokenwarden estimates window consumption in **API-equivalent USD** (reusing the statusline cost signal, sliced into windows via cumulative-cost deltas) and gates on it alongside the dollar caps, honoring observe/enforce. `plan: null` (default) = off. Built-in per-plan ceilings are **estimates** (Anthropic publishes no hard numbers), user-calibratable; tracking is a **local lower-bound** (only what this machine observed). This is what makes tokenwarden useful to subscription users, for whom dollar caps measure money they don't pay.

Plus a **cost-telemetry layer**: read the same `~/.claude/projects/**/*.jsonl` ccusage reads, dedup by `requestId`, price via a versioned table, expose retrospective spend.

**Non-goals (v0.1):** silent model swapping (impossible), retroactive context pruning (impossible), team/cloud dashboards (that's the ccusage/Langfuse lane), being a billing source of truth (estimates only, always labeled).

---

## 3. Architecture

```
tokenwarden/
├─ package.json              # bin: tokenwarden ; ESM ; TypeScript
├─ src/
│  ├─ cli.ts                 # install | uninstall | inspect | status | report | doctor
│  ├─ install.ts             # idempotent, reversible settings.json hook wiring
│  ├─ config.ts              # .tokenwarden.json schema + load/merge (project/user)
│  ├─ hooks/
│  │  ├─ pretool.ts          # budget gate + escalation + modifiedInput bloat-cap
│  │  ├─ prompt-submit.ts    # budget gate + compaction coach (additionalContext)
│  │  ├─ precompact.ts       # veto wasteful auto-compaction
│  │  └─ session.ts          # SessionStart: capture model; SessionEnd: finalize ledger
│  ├─ accounting/
│  │  ├─ jsonl.ts            # locate + parse transcripts; dedup by requestId
│  │  ├─ statusline.ts       # parse live status-line JSON (reliable cap signal)
│  │  ├─ pricing.ts          # versioned pricing table + multiplier rules
│  │  └─ ledger.ts           # SQLite running aggregate (O(1) reads in hooks)
│  └─ mcp/server.ts          # (v0.2) MCP: tokenwarden_inspect + resource
├─ benchmarks/               # SHIP BEFORE LAUNCH — reproducible harness + raw logs
└─ README.md
```

**Stack:** TypeScript, distributed via npm, run with `npx tokenwarden`. Hook entrypoints invoked as `node` (or a tiny shim) reading stdin JSON. Local **SQLite** for the running ledger so hooks do **O(1)** reads — never re-scan all JSONL on a synchronous hook (hooks block the turn).

**Hook performance contract:** every hook must **fail open** (any internal error → exit 0, never block the user because *our* tool broke) and complete in **< 100 ms**. Hard self-timeout.

**Distribution of hook scripts:** `tokenwarden install` writes hook entries into the chosen `settings.json` scope pointing at the installed binary; idempotent (re-running doesn't duplicate), and `tokenwarden uninstall` removes exactly what it added.

---

## 4. Token accounting — data sources

- **JSONL transcripts** (retrospective / reporting): `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. Folder name is `cwd.replace(/[^A-Za-z0-9]/g, '-')` (lossy — read the `cwd` field inside lines to recover the true path). Token usage lives only on `type:"assistant"` lines under `message.usage`: `input_tokens`, `output_tokens`, `cache_creation_input_tokens` (split into `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` — they bill differently), `cache_read_input_tokens`, `server_tool_use.web_search_requests`. **Dedup by `requestId`** (one API call → many lines). **Do not** sum `usage.iterations[]` (duplicates totals). Also honor `CLAUDE_CONFIG_DIR` and `~/.config/claude/projects/` like ccusage.
- **Status-line JSON** (live caps): Claude Code pipes a JSON object to the configured status-line command containing `context_window` (token counts, `used_percentage`, `context_window_size`), `cost.total_cost_usd`, `model.id`, `session_id`. More reliable than JSONL for live enforcement. ⚠️ Exact field names are version-dependent — **verify against live docs before coding** (see §9).
- **Pricing table** (per MTok, USD, verified 2026-05-21 from platform.claude.com): Opus 4.7/4.6/4.5 = $5 in / $25 out / $0.50 cache-read; Sonnet 4.6/4.5 = $3 / $15 / $0.30; Haiku 4.5 = $1 / $5 / $0.10. **Multiplier rule** (avoid hardcoding rows): 5m cache write = 1.25× base in; 1h write = 2× base in; cache read = 0.1× base in. Gotchas to bake in: **Opus 4.7's tokenizer can use ~35% more tokens** for the same text; `inference_geo:"us"` = 1.1×; Fast mode = 6×; Batch = 0.5×; web search = $10/1k. Ship as a versioned snapshot (LiteLLM-style) with a visible "pricing updated [date]" line; let users override with negotiated rates. Always label dollar figures **estimates**.

---

## 5. Hook integration map (verified envelope)

| Primitive | Hook event | Mechanism |
|---|---|---|
| Budget gate (per-call) | `PreToolUse` | block decision + reason when cumulative spend ≥ cap |
| Budget gate (per-prompt) | `UserPromptSubmit` | block + reason ("over budget — run /compact") |
| Compaction coach | `UserPromptSubmit` | inject `additionalContext` nudge near threshold |
| Veto wasteful compaction | `PreCompact` | block (matcher `auto` vs `manual`) |
| Expensive-call escalation | `PreToolUse` | deny + reason with one-keystroke escalation |
| Argument-bloat prevention | `PreToolUse` | `modifiedInput` to cap/rewrite tool args |
| Capture active model | `SessionStart` | persist model id for later hook logic |
| Finalize ledger | `SessionEnd` / `Stop` | reconcile session totals (`Stop` exposes per-turn `tokens_used`) |

> ⚠️ The exact PreToolUse output schema (`permissionDecision` values, `modifiedInput`, `additionalContext`, `decision`/`reason`, exit-code 0/2 semantics) and the full event list came partly from a high-detail research pass — **must be verified against the live docs page before writing hook scripts** (§9).

---

## 6. UX principles (from market research)

- **Observe-only by default for the first session.** Show what tokenwarden *would* block before it enforces. Earns trust, avoids the "uninstalled in 5 minutes because it blocked my work" failure.
- **Friction scaled to cost.** Cheap actions pass silently; only genuinely expensive ones prompt: `Est. $4.20 on Opus — 80% of today's budget. [y] proceed · [s] Sonnet · TOKENWARDEN_FORCE=1 to disable`.
- **Reversible & idempotent install/uninstall.**
- **Complementary to ccusage**, not rival: "track with ccusage, enforce with tokenwarden." Invites a cross-link from ryoppippi's audience instead of a turf war.

---

## 7. The benchmark (do this BEFORE the launch tweet)

Ship `benchmarks/` with raw logs and a reproducible harness. Methodology:
1. Fixed suite of 10–15 representative real tasks on a public sample repo (bugfix, feature add, refactor, subagent fan-out, MCP-heavy session).
2. N ≥ 6 runs each, **with and without** tokenwarden, same model, same prompts, pinned Claude Code version.
3. Measure from the JSONL token logs (same source ccusage reads) — not the displayed `/cost` estimate alone.
4. Report **median + range per scenario**, not one blended number. Disclose variance.
5. Publish raw logs + harness so anyone can reproduce.

**Honest headline options** (pick from real results): conservative *"30–50% lower token spend on typical sessions"*; scoped *"up to 70% on MCP-heavy / long-running agentic sessions"*; pain-tied *"caps runaway sessions before they cost you $1,000s."* **Never** a flat 60–80%.

---

## 8. Launch plan

- **Naming/README:** keep "tokenwarden" (concrete, evokes enforcement). README order: tagline → **block-in-action GIF** (show an Opus call intercepted) → `npx tokenwarden install` → quick start → features → how it works → Agent use/MCP → benchmarks link → **comparison table vs ccusage (reports vs acts)** → MIT license → star-history. GitHub topics: `claude-code`, `claude-usage`, `claude-code-hooks`, `mcp`, `cost-optimization`, `cli`, `ai-agents`.
- **Sequence:** (1) r/ClaudeAI — lead with the *runaway-bill* story, not features; (2) Show HN same day/+1, lead with the reproducible benchmark, defend the number in comments; (3) X — "works alongside ccusage" angle; (4) directories + awesome-list PRs (`hesreallyhim/awesome-claude-code`, `affaan-m/everything-claude-code`, `punkpeye/awesome-mcp-servers`); (5) pitch cost-optimization newsletters/creators the "tool that *enforces* the savings these guides only suggest" angle.
- **Pain framing (verified anecdotes only):** runaway/no-guardrail bills — Uber's 2026 AI budget exhausted in 4 months; a reported $47k/3-days from 23 unattended subagents; indie maker Jenny Ouyang's surprise $1,600. **Do NOT cite** the brief's "$87k/35-eng" or "$4,200/3-days" — neither could be verified.

---

## 9. Pre-coding verification gate (15 min)

Before writing any hook script, WebFetch the live docs and confirm exact contracts (the research pass was high-detail but high precision-to-source ratio on some items):
- `code.claude.com/docs/en/hooks` — exact event names, PreToolUse/UserPromptSubmit/PreCompact **output** schema (`permissionDecision` enum, `modifiedInput`, `additionalContext`, `decision`/`reason`), exit-code 0/2 semantics, timeouts.
- `code.claude.com/docs/en/statusline` — exact status-line JSON field names + version added.
- `@modelcontextprotocol/sdk` — current TS server API (for v0.2 MCP surface).

---

## 10. Decisions

**Resolved (2026-05-21):**
- ✅ **Subagent spend** (`isSidechain:true`) — **counts toward the parent session/project budget.** Matches the runaway-fan-out pain that is the strongest demand signal.

**Resolved (2026-05-22):**
- ✅ **Subscription usage windows** (§2 primitive 5) — landed. Unit is **API-equivalent USD over rolling 5h/7d windows** (not message-count): Anthropic's real limits are token/compute-weighted, and the statusline cost signal is already captured per-session with timestamps. A cost-sample ring buffer in the ledger gives true per-window deltas. Built-in tier ceilings are flagged estimates; off by default (`plan: null`).

**Still open (defer until implementation is greenlit):**
1. **v0.1 scope:** Budget Gate + Compaction Coach first (headline), defer bloat-prevention + escalation to v0.2? Or all four at once?
2. **Observe-only default** for the first session — yes (recommended) or enforce immediately?
3. **Pricing table:** bundle a versioned snapshot (like ccusage) or fetch from LiteLLM at runtime?
4. **MCP server** (`tokenwarden_inspect` + resource): v0.1 or v0.2? (recommend v0.2 to keep v0.1 tight)

---

## Appendix — research provenance

- Hooks system: live Claude Code docs (high detail; flagged for re-verification §9).
- MCP/compaction/status-line: official docs + TS SDK.
- Token data & competitors: **real transcript read on this machine** + ccusage source/issues (most grounded source); pricing from platform.claude.com.
- Market/launch: verified 2026 anecdotes; brief's two cost figures rejected as unverified.
