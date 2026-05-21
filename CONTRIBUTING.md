# Contributing to tokenwarden

Contributions are welcome. This guide covers the essentials.

---

## Before you start

- Open an issue before submitting a non-trivial change. This avoids duplicated effort and lets us discuss the approach before you invest time in an implementation.
- For bug reports, include the output of `npx tokenwarden doctor` and the Claude Code version (`claude --version`).

---

## Development setup

Requirements: Node.js >= 18, npm.

```bash
git clone https://github.com/OWNER/tokenwarden
cd tokenwarden
npm install
npm run build   # tsc; outputs to dist/
npm test        # run the test suite
```

The project uses TypeScript (ESM). Source lives in `src/`. Hook entrypoints in `src/hooks/` must run as plain `node` scripts — no bundler, no runtime transpilation.

---

## Project structure

```
src/
  cli.ts            # CLI commands (install, uninstall, status, report, inspect, doctor, init)
  install.ts        # Idempotent settings.json hook wiring
  config.ts         # .tokenwarden.json schema, defaults, and load/merge
  types.ts          # Shared TypeScript contracts (do not add runtime code here)
  hooks/
    pretool.ts      # Budget gate + escalation + modifiedInput bloat caps
    prompt-submit.ts # Budget gate + compaction coach
    precompact.ts   # Veto wasteful auto-compaction
    session.ts      # SessionStart / SessionEnd / Stop handlers
  accounting/
    jsonl.ts        # JSONL transcript parsing (dedup by requestId)
    statusline.ts   # Live statusline JSON capture
    pricing.ts      # Versioned pricing table
    ledger.ts       # JSON-backed running aggregate
benchmarks/
  run.mjs           # Benchmark harness (zero-dep Node; see benchmarks/README.md)
  scenarios.json    # Benchmark task suite
```

---

## Code conventions

- **Hooks must fail open.** Any unhandled error in a hook must exit 0 (proceed). Never let tokenwarden block a user's work because of our own bug.
- **Hot-path hooks must be fast.** `PreToolUse` and `UserPromptSubmit` run synchronously on every turn. Keep the hot path under 100 ms. No network calls, no JSONL re-scanning. Use the ledger for O(1) reads.
- **All dollar figures are estimates, always labeled.** Never display a cost figure without noting it is an estimate.
- **No auto-compact, no silent model downgrade, no context pruning.** These are documented impossibilities. Do not add features claiming to do them. See `PLAN.md §1` for context.
- **Config changes must update `src/config.ts` and the `DEFAULT_CONFIG` object** to stay in sync with the README and the JSON schema.
- **Pricing table changes** must update the `updated` field in `src/accounting/pricing.ts` and the snapshot date in `benchmarks/run.mjs`.

---

## Adding a feature

1. Check `PLAN.md` for scope. The four feasible primitives are: budget gate, compaction coach, expensive-call escalation, argument-bloat prevention.
2. Add the TypeScript types to `src/types.ts` if the feature introduces new config or ledger shapes.
3. Update `src/config.ts` defaults if a new config field is added.
4. Write a test in `test/`.
5. Update the README config table and field reference if the public config shape changes.

---

## Benchmarks

If you add or change a feature that affects token spend, run the benchmark suite (see `benchmarks/README.md`) and update the results. Do not submit performance claims without measured data. The methodology requires N >= 6 runs per scenario, with and without tokenwarden, on the same model.

---

## Submitting a pull request

- Keep PRs focused. One feature or fix per PR.
- Include a brief description of the change and why it is needed.
- Ensure `npm test` passes and `npm run build` produces no TypeScript errors.
- For hook changes, note whether the change affects fail-open behavior or hot-path performance.

---

## Honest claims policy

Tokenwarden's positioning is built on verified, reproducible claims. Do not add documentation, comments, or error messages that overstate what the tool can do. In particular:

- Never claim "auto-compact" (hooks cannot trigger commands)
- Never claim "silent model downgrade" (no model-selection control in hooks)
- Never claim "prune context" (hooks cannot modify conversation history)
- Never cite unverified cost anecdotes as if they were confirmed

If you are unsure whether a claim is supportable, check `PLAN.md §1` and `RESEARCH.md`.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
