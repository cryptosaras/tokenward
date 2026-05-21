# tokenwarden benchmark methodology

This directory contains the benchmark harness, scenario suite, and raw results for tokenwarden's published performance claims. The methodology is designed to be fully reproducible by anyone with access to Claude Code and Node.js >= 18.

---

## What the benchmark measures

Tokenwarden's four primitives (budget gate, compaction coach, expensive-call escalation, argument-bloat prevention) affect token spend in different ways depending on the task type. A single blended number would hide this variance and be misleading. The suite therefore reports **median + range per scenario**, not a single headline percentage.

The benchmark measures **token spend** (input + output + cache tokens) from the JSONL transcripts Claude Code writes to `~/.claude/projects/`. This is the same data source ccusage reads. Important caveat: JSONL token counts are a known lower bound due to streaming event undercounting (ccusage issue #866). Both the WITH and WITHOUT runs are measured identically, so the relative comparison is meaningful even if the absolute numbers are underestimates.

Estimated cost is computed from the token counts using a versioned pricing snapshot included in the harness.

---

## What is NOT automated

The harness does **not** drive Claude Code. It cannot launch Claude Code, submit prompts, or replay a session. This is a deliberate design constraint: automating prompt submission would introduce nondeterminism from model behavior changes and Claude Code version differences that would undermine reproducibility.

**The operator runs the task suite manually** (or via `claude -p` for headless prompts), then invokes the harness to measure the token delta from the JSONL logs. The harness does the measurement and statistics; the human does the runs.

---

## Procedure

### 1. Prepare

```bash
# Pin the Claude Code version
claude --version > benchmarks/results/cc-version.txt

# Choose a sample repository to run tasks against
# (a small public repo with real code is ideal; the scenarios assume a TypeScript project)
git clone https://github.com/OWNER/sample-repo /tmp/bench-repo
```

### 2. Run WITHOUT tokenwarden

For each scenario in `scenarios.json`, run the task prompt in the sample repo **without** tokenwarden installed. Aim for N >= 6 runs per scenario (to get a stable median). Use the same model for all runs.

After each run:

```bash
npx tokenwarden@latest benchmarks/run.mjs \
  --label without \
  --scenario <scenario-id> \
  --session <session-id-from-claude>
```

Or let the harness find the most recent session automatically:

```bash
node benchmarks/run.mjs --label without --scenario bugfix-ts
```

### 3. Install tokenwarden and run WITH

```bash
npx tokenwarden install
# set mode: "enforce" in .tokenwarden.json
```

Repeat the same prompts for each scenario. After each run:

```bash
node benchmarks/run.mjs --label with --scenario bugfix-ts
```

### 4. Summarize

```bash
node benchmarks/run.mjs --summarize
```

This reads all sample files in `benchmarks/results/` and prints a markdown table: scenario | with median | without median | delta | min/max range.

---

## Controls

- **Same model** for all runs in a scenario pair (document it in `cc-version.txt`)
- **Same prompt** — use the exact text in `scenarios.json`
- **Same sample repo** and same commit
- **Pinned Claude Code version** — document it in `cc-version.txt`
- **Fresh session** for each run (do not reuse sessions across runs)
- **N >= 6** runs per cell (with / without) per scenario
- Discard any run where Claude Code aborted or produced an error that isn't budget-related

---

## What to report

For each scenario:

- Median token spend WITH tokenwarden
- Median token spend WITHOUT tokenwarden
- Percentage reduction (median)
- Min/max range across N runs, both conditions
- Number of valid runs

**Do not** report a single blended number across scenarios. The range across scenarios is meaningful information.

---

## Published claims

The README claims:

- **30–50% lower token spend on typical sessions** (bugfix, feature-add, refactor) — these are the scenarios where argument-bloat prevention on Read/Grep/Glob has the clearest effect
- **Up to ~70% on MCP-heavy and long-running agentic sessions** — these scenarios accumulate large context; compaction coaching and bloat caps compound
- These ranges are pre-launch estimates. Replace with actual measured medians once the benchmark runs are complete. If the real numbers are outside these ranges, update the README claims to match reality. Do not preserve the estimate if the data contradicts it.

Raw sample files and the harness are published in this directory so anyone can verify or extend the results.

---

## Known limitations

1. JSONL token counts are a lower bound (streaming undercounting). Both cells are equally undercounted, making relative comparisons valid but absolute numbers unreliable.
2. Model behavior is nondeterministic. N >= 6 mitigates this but does not eliminate variance.
3. The sample repo and prompts affect the numbers. Different repos/tasks will produce different results.
4. Claude Code version matters. Hook behavior and token accounting may change between versions.
5. Pricing estimates use a snapshot from 2026-05-21. Rate changes after that date will affect cost estimates but not token counts.
