// Statusline capture + render.
//
// This is tokenwarden's most reliable live cost signal (PLAN §4): Claude Code
// pipes a JSON object to the configured statusLine command on every render.
// We (1) persist a StatuslineSnapshot into the ledger so the budget gate has a
// fresh cumulative-cost figure, and (2) print a concise one-line status the
// user sees in their UI.
//
// Capture runs in ALL modes (observe/enforce/force/disable-is-handled-upstream):
// it never blocks, never enforces — it only records and renders.
import type {
  Config,
  Ledger,
  StatuslineInput,
  StatuslineSnapshot,
} from "../types.js";
import { usd } from "../util.js";

const DEFAULT_CONTEXT_WINDOW = 200000;

/** Build a normalized snapshot from the raw statusline JSON. */
export function toSnapshot(input: StatuslineInput): StatuslineSnapshot {
  const cw = input.context_window ?? {};
  return {
    sessionId: input.session_id ?? "",
    modelId: input.model?.id ?? "",
    modelDisplayName: input.model?.display_name ?? "",
    cwd: input.workspace?.current_dir ?? input.cwd ?? "",
    totalCostUsd: input.cost?.total_cost_usd ?? 0,
    contextUsedPercent: cw.used_percentage ?? null,
    contextWindowSize: cw.context_window_size ?? DEFAULT_CONTEXT_WINDOW,
    exceeds200k: input.exceeds_200k_tokens ?? false,
    capturedAt: Date.now(),
  };
}

/**
 * Render the one-line status string. Adds a warning marker when spend is
 * over/near a configured cap or context is high. Pure (no IO) for testing.
 */
export function renderStatusline(
  snap: StatuslineSnapshot,
  config: Config,
): string {
  const parts: string[] = [`tokenwarden ⛨ ${usd(snap.totalCostUsd)}`];

  if (snap.contextUsedPercent != null) {
    parts.push(`${Math.round(snap.contextUsedPercent)}% ctx`);
  }

  const markers: string[] = [];
  const sessionCap = config.budgets.session.usd;
  if (sessionCap != null && sessionCap > 0) {
    if (snap.totalCostUsd >= sessionCap) {
      markers.push(`! over ${usd(sessionCap)} session`);
    } else if (snap.totalCostUsd >= sessionCap * 0.8) {
      markers.push(`~ near ${usd(sessionCap)} session`);
    }
  }
  if (
    snap.contextUsedPercent != null &&
    snap.contextUsedPercent >= config.compaction.coachAtPercent
  ) {
    markers.push("/compact?");
  }
  if (snap.exceeds200k) markers.push(">200k");

  const line = parts.join(" · ");
  return markers.length ? `${line} · ${markers.join(" · ")}` : line;
}

/**
 * Capture handler: record the snapshot, return the line to print.
 * dispatch.ts is responsible for writing the returned line to stdout.
 */
export function handleStatusline(
  input: StatuslineInput,
  config: Config,
  ledger: Ledger,
): string {
  const snap = toSnapshot(input);
  if (snap.sessionId) ledger.recordStatusline(snap);
  return renderStatusline(snap, config);
}
