import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  Config,
  Ledger,
  LedgerAggregates,
  LedgerEvent,
  LedgerState,
  SessionRecord,
  StatuslineSnapshot,
} from "../src/types.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { handlePreToolUse } from "../src/hooks/pretool.js";
import { handleUserPromptSubmit } from "../src/hooks/prompt-submit.js";
import { handlePreCompact } from "../src/hooks/precompact.js";
import { handleStatusline, toSnapshot } from "../src/hooks/statusline.js";

// --- Fake ledger: in-memory, implements the Ledger interface -----------------
class FakeLedger implements Ledger {
  state: LedgerState = { version: 1, sessions: {}, events: [] };

  read(): LedgerState {
    return this.state;
  }
  recordStatusline(snap: StatuslineSnapshot): void {
    const existing = this.state.sessions[snap.sessionId];
    this.state.sessions[snap.sessionId] = {
      sessionId: snap.sessionId,
      modelId: snap.modelId || existing?.modelId || "",
      cwd: snap.cwd || existing?.cwd || "",
      costUsd: snap.totalCostUsd,
      contextUsedPercent: snap.contextUsedPercent,
      startedAt: existing?.startedAt ?? snap.capturedAt,
      updatedAt: snap.capturedAt,
      startDate: existing?.startDate ?? "2026-05-21",
    };
  }
  recordSessionModel(sessionId: string, modelId: string, cwd: string): void {
    this.state.sessions[sessionId] = {
      sessionId,
      modelId,
      cwd,
      costUsd: 0,
      contextUsedPercent: null,
      startedAt: 0,
      updatedAt: 0,
      startDate: "2026-05-21",
    };
  }
  recordEvent(ev: LedgerEvent): void {
    this.state.events.push(ev);
  }
  aggregates(sessionId: string, cwd: string): LedgerAggregates {
    const s = this.state.sessions[sessionId];
    let projectUsd = 0;
    for (const rec of Object.values(this.state.sessions)) {
      if (cwd && rec.cwd === cwd) projectUsd += rec.costUsd;
    }
    return {
      sessionUsd: s?.costUsd ?? 0,
      dailyUsd: s?.costUsd ?? 0,
      projectUsd,
      fiveHourUsd: 0,
      weeklyUsd: 0,
      fiveHourByClass: {},
      weeklyByClass: {},
    };
  }
}

function cfg(over: Partial<Config> = {}): Config {
  return { ...structuredClone(DEFAULT_CONFIG), ...over };
}

function seedSession(
  l: FakeLedger,
  rec: Partial<SessionRecord> & { sessionId: string },
): void {
  l.state.sessions[rec.sessionId] = {
    sessionId: rec.sessionId,
    modelId: rec.modelId ?? "claude-sonnet-4-6",
    cwd: rec.cwd ?? "/proj",
    costUsd: rec.costUsd ?? 0,
    contextUsedPercent: rec.contextUsedPercent ?? null,
    startedAt: 0,
    updatedAt: 0,
    startDate: "2026-05-21",
  };
}

const baseTool = {
  hook_event_name: "PreToolUse" as const,
  session_id: "s1",
  transcript_path: "/t",
  cwd: "/proj",
  tool_use_id: "tu1",
};

// --- (1) observe mode never denies, but DOES record would-block --------------
test("observe mode never denies when over budget, records would-block", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 999, modelId: "claude-sonnet-4-6" });
  const config = cfg(); // default mode === "observe", session cap $5

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Read", tool_input: { file_path: "/x", limit: 10 } },
    config,
    l,
  );

  assert.equal(out, null, "observe must proceed (no decision)");
  const wb = l.state.events.find((e) => e.kind === "would-block");
  assert.ok(wb, "must record a would-block event");
  assert.match(wb!.detail, /budget/i);
});

// --- (2) enforce mode denies when session cost >= cap ------------------------
test("enforce mode denies at/over session budget cap", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 5, modelId: "claude-sonnet-4-6" });
  const config = cfg({ mode: "enforce" });

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Read", tool_input: { file_path: "/x", limit: 10 } },
    config,
    l,
  );

  assert.ok(out, "must return a decision");
  assert.equal(out!.hookSpecificOutput?.permissionDecision, "deny");
  assert.match(out!.hookSpecificOutput!.permissionDecisionReason!, /session budget/i);
  assert.ok(l.state.events.some((e) => e.kind === "budget-block"));
});

// --- (3) TOKENWARDEN_FORCE skips enforcement ---------------------------------
test("force opt skips enforcement even over budget", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 999, modelId: "claude-sonnet-4-6" });
  const config = cfg({ mode: "enforce" });

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Read", tool_input: { file_path: "/x", limit: 10 } },
    config,
    l,
    { force: true },
  );

  assert.equal(out, null, "force must proceed");
  // still records what it would have done
  assert.ok(l.state.events.some((e) => e.kind === "would-block"));
});

// --- (4) Read without limit gets modifiedInput.limit set ---------------------
test("enforce: Read without limit is capped via modifiedInput", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, modelId: "claude-sonnet-4-6" });
  const config = cfg({ mode: "enforce" });

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Read", tool_input: { file_path: "/x" } },
    config,
    l,
  );

  assert.ok(out, "must return allow + modifiedInput");
  assert.equal(out!.hookSpecificOutput?.permissionDecision, "allow");
  assert.equal(
    out!.hookSpecificOutput?.modifiedInput?.limit,
    config.bloat.readMaxLines,
  );
});

test("observe: Read without limit does NOT modify input, records would-block", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, modelId: "claude-sonnet-4-6" });
  const config = cfg(); // observe

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Read", tool_input: { file_path: "/x" } },
    config,
    l,
  );

  assert.equal(out, null);
  assert.ok(l.state.events.some((e) => e.kind === "would-block" && /bloat/i.test(e.detail)));
});

// --- expensive-call escalation (cost-scaled; PLAN §6) ------------------------
test("enforce: expensive model + high-cost subagent spawn -> ask", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, modelId: "claude-opus-4-7" });
  const config = cfg({ mode: "enforce" });

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Task", tool_input: { description: "x", prompt: "do a big refactor" } },
    config,
    l,
  );

  assert.ok(out, "a subagent spawn on Opus should escalate");
  assert.equal(out!.hookSpecificOutput?.permissionDecision, "ask");
  assert.match(out!.hookSpecificOutput!.permissionDecisionReason!, /Est\./);
  assert.match(out!.hookSpecificOutput!.permissionDecisionReason!, /subagent/i);
});

test("expensive model + cheap scoped Grep passes silently (no nagging)", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, modelId: "claude-opus-4-7" });
  const config = cfg({ mode: "enforce" });

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Grep", tool_input: { pattern: "x", path: "/proj" } },
    config,
    l,
  );

  assert.equal(out, null, "a cheap scoped search must not prompt even on Opus");
});

test("cheap model + high-cost tool passes silently (escalation is opt-in to expensive models)", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, modelId: "claude-haiku-4-5" });
  const config = cfg({ mode: "enforce" });

  const out = handlePreToolUse(
    { ...baseTool, tool_name: "Task", tool_input: { description: "x", prompt: "y" } },
    config,
    l,
  );

  assert.equal(out, null);
});

// --- (5) compaction coach injects additionalContext at threshold -------------
test("compaction coach injects additionalContext at/over threshold", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, contextUsedPercent: 80 });
  const config = cfg(); // coachAtPercent 80

  const out = handleUserPromptSubmit(
    {
      hook_event_name: "UserPromptSubmit",
      session_id: "s1",
      transcript_path: "/t",
      cwd: "/proj",
      prompt: "do a thing",
    },
    config,
    l,
  );

  assert.ok(out);
  assert.match(out!.hookSpecificOutput!.additionalContext!, /\/compact/);
  assert.ok(l.state.events.some((e) => e.kind === "compaction-coach"));
});

test("compaction coach does not fire below threshold", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", costUsd: 0, contextUsedPercent: 50 });
  const config = cfg();

  const out = handleUserPromptSubmit(
    {
      hook_event_name: "UserPromptSubmit",
      session_id: "s1",
      transcript_path: "/t",
      cwd: "/proj",
      prompt: "do a thing",
    },
    config,
    l,
  );

  assert.equal(out, null);
});

// --- precompact veto ---------------------------------------------------------
test("enforce: auto-compact below threshold is vetoed; manual is not", () => {
  const l = new FakeLedger();
  seedSession(l, { sessionId: "s1", contextUsedPercent: 20 });
  const config = cfg({ mode: "enforce" });

  const auto = handlePreCompact(
    {
      hook_event_name: "PreCompact",
      session_id: "s1",
      transcript_path: "/t",
      cwd: "/proj",
      trigger: "auto",
    },
    config,
    l,
  );
  assert.equal(auto!.decision, "block");

  const manual = handlePreCompact(
    {
      hook_event_name: "PreCompact",
      session_id: "s1",
      transcript_path: "/t",
      cwd: "/proj",
      trigger: "manual",
    },
    config,
    l,
  );
  assert.equal(manual, null);
});

// --- (6) statusline capture produces the right snapshot fields ---------------
test("statusline capture builds a StatuslineSnapshot with right fields", () => {
  const l = new FakeLedger();
  const config = cfg();

  const line = handleStatusline(
    {
      session_id: "s1",
      model: { id: "claude-opus-4-7", display_name: "Opus 4.7" },
      workspace: { current_dir: "/proj" },
      cost: { total_cost_usd: 0.12 },
      context_window: { used_percentage: 8, context_window_size: 200000 },
      exceeds_200k_tokens: false,
    },
    config,
    l,
  );

  const snap = l.state.sessions["s1"];
  assert.ok(snap);
  assert.equal(snap!.modelId, "claude-opus-4-7");
  assert.equal(snap!.cwd, "/proj");
  assert.equal(snap!.costUsd, 0.12);
  assert.equal(snap!.contextUsedPercent, 8);
  assert.match(line, /tokenwarden/);
  assert.match(line, /8% ctx/);
});

test("toSnapshot falls back to cwd and default context window", () => {
  const snap = toSnapshot({ session_id: "s2", cwd: "/fallback" });
  assert.equal(snap.cwd, "/fallback");
  assert.equal(snap.contextWindowSize, 200000);
  assert.equal(snap.totalCostUsd, 0);
  assert.equal(snap.contextUsedPercent, null);
});
