// PreToolUse handler: budget gate -> argument-bloat prevention -> expensive-call
// escalation. First decisive outcome wins; if nothing fires, proceed (null).
// Bloat caps run before escalation so an oversized Read is silently capped
// rather than prompting — escalation is reserved for genuinely expensive calls.
//
// Observe mode (PLAN §6) NEVER emits deny/ask. Instead it records a `would-block`
// event describing what enforce mode would have done, and proceeds. modifiedInput
// rewrites are themselves a form of "acting", so in observe mode the bloat rules
// also only record would-block and proceed.
import type {
  Budget,
  Config,
  HookOutput,
  Ledger,
  PreToolUseInput,
} from "../types.js";
import { usd } from "../util.js";
import { preToolDecision } from "./_wrap.js";
import { estimateCallUsd } from "../accounting/pricing.js";

export interface HandlerOpts {
  /** TOKENWARDEN_FORCE=1 — skip all enforcement, still record events. */
  force?: boolean;
}

const FORCE_HINT = "set TOKENWARDEN_FORCE=1 to override";

/** Result of evaluating all budget caps for a session/project. */
export interface BudgetViolation {
  /** Human label naming the breached budget. */
  label: string;
  cap: number;
  spent: number;
}

/**
 * Evaluate budget caps in fixed order (session -> daily -> project -> perModel)
 * and return the first breach, or null. Shared by pretool + prompt-submit.
 */
export function checkBudgets(
  config: Config,
  agg: { sessionUsd: number; dailyUsd: number; projectUsd: number },
  modelId: string,
): BudgetViolation | null {
  const b = config.budgets;
  const check = (cap: number | null, spent: number, label: string): BudgetViolation | null =>
    cap != null && cap > 0 && spent >= cap ? { label, cap, spent } : null;

  return (
    check(b.session.usd, agg.sessionUsd, "session budget") ??
    check(b.daily.usd, agg.dailyUsd, "daily budget") ??
    check(b.project.usd, agg.projectUsd, "project budget") ??
    checkPerModel(b.perModel, agg.sessionUsd, modelId)
  );
}

function checkPerModel(
  perModel: Record<string, Budget>,
  sessionUsd: number,
  modelId: string,
): BudgetViolation | null {
  if (!modelId) return null;
  for (const [key, budget] of Object.entries(perModel)) {
    if (key && modelId.includes(key) && budget.usd != null && budget.usd > 0) {
      if (sessionUsd >= budget.usd) {
        return { label: `per-model budget (${key})`, cap: budget.usd, spent: sessionUsd };
      }
    }
  }
  return null;
}

function budgetReason(v: BudgetViolation): string {
  return `tokenwarden: ${v.label} reached — spent ${usd(v.spent)} of ${usd(v.cap)}. Run /compact, start a fresh session, or ${FORCE_HINT}.`;
}

function modelIsExpensive(config: Config, modelId: string): boolean {
  if (!modelId) return false;
  return config.escalation.expensiveModels.some((m) => m && modelId.includes(m));
}

/** Whether a search tool call is unscoped (no path / no glob narrowing). */
function isUnscopedSearch(toolName: string, toolInput: Record<string, unknown>): boolean {
  if (toolName !== "Grep" && toolName !== "Glob") return false;
  const hasPath = typeof toolInput.path === "string" && toolInput.path.length > 0;
  const hasGlob = typeof toolInput.glob === "string" && toolInput.glob.length > 0;
  return !hasPath && !hasGlob;
}

/**
 * PreToolUse handler. Returns a HookOutput decision, or null to proceed.
 * `force` skips enforcement (no deny/ask/modifiedInput) but still records events.
 */
export function handlePreToolUse(
  input: PreToolUseInput,
  config: Config,
  ledger: Ledger,
  opts: HandlerOpts = {},
): HookOutput | null {
  const sessionId = input.session_id;
  const cwd = input.cwd;
  const toolName = input.tool_name;
  const toolInput = (input.tool_input ?? {}) as Record<string, unknown>;

  const observe = config.mode === "observe";
  const enforce = !observe && !opts.force;

  // PreToolUse has no reliable model field — look it up from the ledger.
  const modelId = ledger.read().sessions[sessionId]?.modelId ?? "";
  const agg = ledger.aggregates(sessionId, cwd);

  // 1) Budget gate (deny) ---------------------------------------------------
  const violation = checkBudgets(config, agg, modelId);
  if (violation) {
    const reason = budgetReason(violation);
    if (enforce) {
      ledger.recordEvent({
        at: Date.now(),
        sessionId,
        kind: "budget-block",
        detail: reason,
        estUsd: violation.spent,
      });
      return preToolDecision("deny", reason);
    }
    ledger.recordEvent({
      at: Date.now(),
      sessionId,
      kind: "would-block",
      detail: `[budget] would DENY ${toolName}: ${reason}`,
      estUsd: violation.spent,
    });
    // observe/force: proceed but keep scanning? Budget is the hardest gate;
    // once over budget we stop here (don't also rewrite args).
    return null;
  }

  // 2) Argument-bloat prevention (silent caps + scope prompts) --------------
  // Run before escalation so an oversized Read is *silently capped* rather than
  // interrupting the user with a prompt (PLAN §6: cheap actions pass silently).
  const bloat = evaluateBloat(toolName, toolInput, config);
  if (bloat) {
    if (enforce) {
      ledger.recordEvent({ at: Date.now(), sessionId, kind: "bloat-cap", detail: bloat.reason });
      return bloat.kind === "ask"
        ? preToolDecision("ask", bloat.reason)
        : preToolDecision("allow", bloat.reason, bloat.modifiedInput);
    }
    // observe/force: rewriting args is "acting" — only record would-block.
    ledger.recordEvent({
      at: Date.now(),
      sessionId,
      kind: "would-block",
      detail: `[bloat] would ${bloat.kind === "ask" ? "ASK" : "CAP"} ${toolName}: ${bloat.reason}`,
    });
    return null;
  }

  // 3) Expensive-call escalation (ask) -------------------------------------
  // Friction scaled to cost (PLAN §6): only a *genuinely expensive* call on an
  // expensive model prompts. The prime target is subagent fan-out (Task/Agent),
  // the documented runaway-cost vector. Cheap actions pass silently.
  if (config.escalation.enabled && modelIsExpensive(config, modelId)) {
    const est = estimateToolCallUsd(modelId, toolName, toolInput, config.pricingOverrides);
    if (est >= config.escalation.trivialThresholdUsd) {
      const reason = `tokenwarden: Est. ${usd(est)} on ${modelId} for ${describeTool(toolName)} — genuinely expensive on this model. Switch to a cheaper model, narrow the request, or ${FORCE_HINT}.`;
      if (enforce) {
        ledger.recordEvent({ at: Date.now(), sessionId, kind: "escalation", detail: reason, estUsd: est });
        return preToolDecision("ask", reason);
      }
      ledger.recordEvent({
        at: Date.now(),
        sessionId,
        kind: "would-block",
        detail: `[escalation] would ASK on ${toolName}: ${reason}`,
        estUsd: est,
      });
      return null;
    }
  }

  return null;
}

/** A short, human description of a tool for escalation messaging. */
function describeTool(toolName: string): string {
  if (toolName === "Task" || toolName === "Agent") return "a subagent spawn";
  if (toolName === "WebFetch" || toolName === "WebSearch") return `a ${toolName}`;
  return `a ${toolName} call`;
}

/**
 * Rough pre-execution cost estimate for escalation gating. Token assumptions
 * vary by tool so the estimate reflects real risk: subagent spawns fan out and
 * cost the most; most tools are cheap and fall well below the threshold. The
 * figure is a friction signal, never a billing number (always labeled "Est.").
 */
function estimateToolCallUsd(
  modelId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  overrides: Config["pricingOverrides"],
): number {
  try {
    let inputTokens = 8000;
    let outputTokens = 1500;
    if (toolName === "Task" || toolName === "Agent") {
      // A subagent does real multi-call work — the runaway-cost vector.
      inputTokens = 60000;
      outputTokens = 12000;
    } else if (toolName === "WebFetch") {
      inputTokens = 30000;
      outputTokens = 2000;
    } else if (toolName === "WebSearch") {
      inputTokens = 15000;
      outputTokens = 2000;
    }
    return estimateCallUsd(modelId, { inputTokens, outputTokens }, undefined, overrides);
  } catch {
    return 0;
  }
}

type BloatAction =
  | { kind: "cap"; reason: string; modifiedInput: Record<string, unknown> }
  | { kind: "ask"; reason: string };

/** Decide whether a tool call needs a bloat cap / scope prompt. */
export function evaluateBloat(
  toolName: string,
  toolInput: Record<string, unknown>,
  config: Config,
): BloatAction | null {
  const bloat = config.bloat;

  // Read with missing or oversized limit -> cap to readMaxLines.
  if (toolName === "Read" && bloat.readMaxLines != null && bloat.readMaxLines > 0) {
    const limit = toolInput.limit;
    const hasLimit = typeof limit === "number" && Number.isFinite(limit);
    if (!hasLimit || (limit as number) > bloat.readMaxLines) {
      return {
        kind: "cap",
        reason: `tokenwarden: capped Read.limit to ${bloat.readMaxLines} lines to avoid dumping a huge file into context.`,
        modifiedInput: { ...toolInput, limit: bloat.readMaxLines },
      };
    }
  }

  // Bash with oversized timeout -> cap to bashMaxTimeoutMs.
  if (toolName === "Bash" && bloat.bashMaxTimeoutMs != null && bloat.bashMaxTimeoutMs > 0) {
    const timeout = toolInput.timeout;
    if (typeof timeout === "number" && Number.isFinite(timeout) && timeout > bloat.bashMaxTimeoutMs) {
      return {
        kind: "cap",
        reason: `tokenwarden: capped Bash timeout to ${bloat.bashMaxTimeoutMs}ms to avoid a runaway command.`,
        modifiedInput: { ...toolInput, timeout: bloat.bashMaxTimeoutMs },
      };
    }
  }

  // Unscoped Grep/Glob -> ask the model to scope it.
  if (bloat.refuseUnscopedSearch && isUnscopedSearch(toolName, toolInput)) {
    return {
      kind: "ask",
      reason: `tokenwarden: unscoped ${toolName} can flood context. Add a "path" or "glob" to narrow the search, or ${FORCE_HINT}.`,
    };
  }

  return null;
}
