// UserPromptSubmit handler: hard budget gate (block) + compaction coach
// (additionalContext nudge). The coach is non-blocking and runs in BOTH modes;
// the budget block obeys observe/force exactly like pretool.
import type {
  Config,
  HookOutput,
  Ledger,
  UserPromptSubmitInput,
} from "../types.js";
import { usd } from "../util.js";
import { checkBudgets, type HandlerOpts } from "./pretool.js";

function coachText(percent: number, threshold: number): string {
  return `tokenwarden: context is at ${Math.round(percent)}% (coach threshold ${threshold}%). Consider running /compact to shrink the conversation before it gets expensive. (tokenwarden cannot run commands for you.)`;
}

/**
 * UserPromptSubmit handler. Returns:
 *  - a top-level { decision: "block", reason } when over a hard cap (enforce)
 *  - an additionalContext nudge when near the compaction threshold
 *  - null to proceed
 *
 * If both fire, the block wins (the user is over budget; nudging is moot).
 */
export function handleUserPromptSubmit(
  input: UserPromptSubmitInput,
  config: Config,
  ledger: Ledger,
  opts: HandlerOpts = {},
): HookOutput | null {
  const sessionId = input.session_id;
  const cwd = input.cwd;

  const observe = config.mode === "observe";
  const enforce = !observe && !opts.force;

  const state = ledger.read();
  const session = state.sessions[sessionId];
  const modelId = session?.modelId ?? "";
  const agg = ledger.aggregates(sessionId, cwd);

  // 1) Hard budget gate -----------------------------------------------------
  const violation = checkBudgets(config, agg, modelId);
  if (violation) {
    const reason = `tokenwarden: ${violation.label} reached — spent ${usd(violation.spent)} of ${usd(violation.cap)}. Run /compact, start a fresh session, or set TOKENWARDEN_FORCE=1 to override.`;
    if (enforce) {
      ledger.recordEvent({
        at: Date.now(),
        sessionId,
        kind: "budget-block",
        detail: reason,
        estUsd: violation.spent,
      });
      return { decision: "block", reason };
    }
    ledger.recordEvent({
      at: Date.now(),
      sessionId,
      kind: "would-block",
      detail: `[budget] would BLOCK prompt: ${reason}`,
      estUsd: violation.spent,
    });
    // fall through to coaching even when observing the budget breach.
  }

  // 2) Compaction coach (non-blocking, both modes) --------------------------
  const percent = session?.contextUsedPercent;
  if (percent != null && percent >= config.compaction.coachAtPercent) {
    const text = coachText(percent, config.compaction.coachAtPercent);
    ledger.recordEvent({
      at: Date.now(),
      sessionId,
      kind: "compaction-coach",
      detail: text,
    });
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: text,
      },
    };
  }

  return null;
}
