// Session lifecycle handlers.
//
// SessionStart: capture the active model id (PreToolUse later relies on this,
// since PreToolUse input has no reliable model field), and optionally inject a
// one-time line announcing tokenwarden is active and in which mode.
//
// SessionEnd / Stop: record a finalize event for observability. Never blocks.
import type {
  Config,
  HookOutput,
  Ledger,
  SessionEndInput,
  SessionStartInput,
  StopInput,
} from "../types.js";
import { usd } from "../util.js";
import { additionalContext } from "./_wrap.js";

/**
 * SessionStart handler. Persists the model when present, returns a one-time
 * announce line (additionalContext) so the user knows tokenwarden is active.
 */
export function handleSessionStart(
  input: SessionStartInput,
  config: Config,
  ledger: Ledger,
): HookOutput | null {
  if (input.model) {
    ledger.recordSessionModel(input.session_id, input.model, input.cwd);
  }

  // Only announce on a genuine start (not resume/clear/compact restarts).
  if (input.source === "startup") {
    const text = `tokenwarden is active in ${config.mode} mode. ${
      config.mode === "observe"
        ? "It will log what it would block without interrupting you."
        : "It will enforce budget caps and may block expensive/wasteful actions."
    }`;
    return additionalContext("SessionStart", text);
  }

  return null;
}

/**
 * SessionEnd / Stop handler. Records a finalize event with the session's latest
 * known cost. Observability only — never returns a blocking decision.
 */
export function handleSessionFinalize(
  input: SessionEndInput | StopInput,
  _config: Config,
  ledger: Ledger,
): HookOutput | null {
  const sessionId = input.session_id;
  const session = ledger.read().sessions[sessionId];
  const cost = session?.costUsd ?? 0;
  const reason = input.hook_event_name === "SessionEnd"
    ? (input as SessionEndInput).reason
    : "stop";

  ledger.recordEvent({
    at: Date.now(),
    sessionId,
    kind: "session-finalize", // observability only; finalize never blocks
    detail: `${input.hook_event_name} (${reason}) — session cost ${usd(cost)}`,
    estUsd: cost,
  });

  return null;
}
