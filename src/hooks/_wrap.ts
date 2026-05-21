// Fail-open execution wrapper for every hook entrypoint.
//
// Hook contract (PLAN §3): a hook must NEVER block the user because tokenwarden
// itself broke. Any internal error, or exceeding the self-timeout, resolves to
// a no-op "proceed" (exit 0, empty/no decision). The only way tokenwarden
// blocks is by deliberately emitting a decision.
import type { HookOutput } from "../types.js";

/** Hard self-timeout. Comfortably under Claude Code's per-event timeouts. */
export const HOOK_TIMEOUT_MS = 2000;

/**
 * Run a hook handler with fail-open semantics:
 *  - handler returns a HookOutput  -> printed as JSON, exit 0
 *  - handler returns null/undefined -> nothing printed, exit 0 (proceed)
 *  - handler throws / rejects       -> nothing printed, exit 0 (proceed)
 *  - handler exceeds timeout        -> nothing printed, exit 0 (proceed)
 *
 * `decision` outputs (deny/ask/block) are the ONLY way the user is interrupted,
 * and they only happen when a handler explicitly returns one.
 */
export async function runHook(
  handler: () => Promise<HookOutput | null | void> | HookOutput | null | void,
): Promise<void> {
  let settled = false;
  const finish = (out: HookOutput | null | void): void => {
    if (settled) return;
    settled = true;
    if (out && Object.keys(out).length > 0) {
      process.stdout.write(JSON.stringify(out));
    }
    process.exitCode = 0;
  };

  const timer = setTimeout(() => finish(null), HOOK_TIMEOUT_MS);
  // Don't let the timer keep the process alive once real work finishes.
  if (typeof timer.unref === "function") timer.unref();

  try {
    const out = await handler();
    clearTimeout(timer);
    finish(out);
  } catch {
    clearTimeout(timer);
    finish(null);
  }
}

/** Build a PreToolUse decision output. */
export function preToolDecision(
  decision: "allow" | "deny" | "ask",
  reason: string,
  modifiedInput?: Record<string, unknown>,
): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
      ...(modifiedInput ? { modifiedInput } : {}),
    },
  };
}

/** Inject context without blocking (SessionStart / UserPromptSubmit / PreToolUse). */
export function additionalContext(
  event: "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse",
  text: string,
): HookOutput {
  return {
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  };
}
