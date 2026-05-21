// PreCompact handler: veto wasteful AUTO compaction. Manual compaction is never
// vetoed. We only act when the matcher is `auto` (delivered as `matcher_value`
// in some versions, `trigger` in others). If the session's last-known context
// usage is below `vetoAutoBelowPercent`, an auto-compaction is wasteful (it
// throws away a cache for little benefit) and we block it in enforce mode.
import type { Config, HookOutput, Ledger, PreCompactInput } from "../types.js";
import type { HandlerOpts } from "./pretool.js";

/**
 * PreCompact handler. Returns { decision: "block", reason } to veto, or null.
 * Observe/force never block — they record a would-block event instead.
 */
export function handlePreCompact(
  input: PreCompactInput,
  config: Config,
  ledger: Ledger,
  opts: HandlerOpts = {},
): HookOutput | null {
  const matcher = input.matcher_value ?? input.trigger;
  if (matcher !== "auto") return null; // never veto manual compaction

  const sessionId = input.session_id;
  const observe = config.mode === "observe";
  const enforce = !observe && !opts.force;

  const session = ledger.read().sessions[sessionId];
  const percent = session?.contextUsedPercent;
  // If we have no signal, don't veto — fail open toward letting compaction run.
  if (percent == null) return null;

  if (percent >= config.compaction.vetoAutoBelowPercent) return null;

  const reason = `tokenwarden: auto-compaction fired at ${Math.round(percent)}% context (below ${config.compaction.vetoAutoBelowPercent}% threshold). Compacting this early discards a usable cache for little gain. Continue working or run /compact manually when needed; set TOKENWARDEN_FORCE=1 to allow auto-compaction.`;

  if (enforce) {
    ledger.recordEvent({
      at: Date.now(),
      sessionId,
      kind: "compaction-veto",
      detail: reason,
    });
    return { decision: "block", reason };
  }

  ledger.recordEvent({
    at: Date.now(),
    sessionId,
    kind: "would-block",
    detail: `[compaction] would VETO auto-compact: ${reason}`,
  });
  return null;
}
