// JSON-backed ledger. No native dependencies — chosen over SQLite because
// writes happen per-turn (not per-token), the state is small, and a pure-JS
// store guarantees a clean `npx tokenwarden` install on every platform.
//
// Reads parse one small JSON file; aggregates are computed in-memory over a
// handful of session records, which is effectively O(1) on the hook hot path.
import { join } from "node:path";
import type {
  Ledger,
  LedgerState,
  LedgerEvent,
  LedgerAggregates,
  CostSample,
  StatuslineSnapshot,
} from "../types.js";
import {
  stateDir,
  readJsonSafe,
  writeJsonAtomic,
  localDate,
  modelClass,
} from "../util.js";

const LEDGER_VERSION = 2; // v2 adds costSamples; v1 files are read tolerantly.
const MAX_EVENTS = 500;
const MAX_SAMPLES = 1000;
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Drop samples older than this (weekly window + margin) to bound growth. */
const SAMPLE_TTL_MS = 8 * 24 * 60 * 60 * 1000;

function emptyState(): LedgerState {
  return { version: LEDGER_VERSION, sessions: {}, events: [], costSamples: [] };
}

export function ledgerPath(): string {
  return join(stateDir(), "ledger.json");
}

export class JsonLedger implements Ledger {
  private readonly path: string;

  constructor(path: string = ledgerPath()) {
    this.path = path;
  }

  read(): LedgerState {
    const state = readJsonSafe<LedgerState>(this.path, emptyState());
    // Tolerate older/garbled files: coerce shape.
    if (!state.sessions || typeof state.sessions !== "object") state.sessions = {};
    if (!Array.isArray(state.events)) state.events = [];
    if (!Array.isArray(state.costSamples)) state.costSamples = [];
    return state;
  }

  private write(state: LedgerState): void {
    writeJsonAtomic(this.path, state);
  }

  recordStatusline(snap: StatuslineSnapshot): void {
    const state = this.read();
    const existing = state.sessions[snap.sessionId];
    const startedAt = existing?.startedAt ?? snap.capturedAt;
    state.sessions[snap.sessionId] = {
      sessionId: snap.sessionId,
      modelId: snap.modelId || existing?.modelId || "",
      cwd: snap.cwd || existing?.cwd || "",
      costUsd: snap.totalCostUsd,
      contextUsedPercent: snap.contextUsedPercent,
      startedAt,
      updatedAt: snap.capturedAt,
      startDate: existing?.startDate ?? localDate(startedAt),
    };

    // Record a cumulative-cost sample so rolling windows can take deltas.
    const samples = state.costSamples ?? (state.costSamples = []);
    samples.push({
      at: snap.capturedAt,
      sessionId: snap.sessionId,
      cumUsd: snap.totalCostUsd,
      modelId: snap.modelId || existing?.modelId || "",
    });
    const cutoff = snap.capturedAt - SAMPLE_TTL_MS;
    let pruned = samples.filter((s) => s.at >= cutoff);
    if (pruned.length > MAX_SAMPLES) pruned = pruned.slice(-MAX_SAMPLES);
    state.costSamples = pruned;

    this.write(state);
  }

  recordSessionModel(sessionId: string, modelId: string, cwd: string): void {
    const state = this.read();
    const now = Date.now();
    const existing = state.sessions[sessionId];
    if (existing) {
      existing.modelId = modelId || existing.modelId;
      if (cwd) existing.cwd = cwd;
      existing.updatedAt = now;
    } else {
      state.sessions[sessionId] = {
        sessionId,
        modelId,
        cwd,
        costUsd: 0,
        contextUsedPercent: null,
        startedAt: now,
        updatedAt: now,
        startDate: localDate(now),
      };
    }
    this.write(state);
  }

  recordEvent(ev: LedgerEvent): void {
    const state = this.read();
    state.events.push(ev);
    if (state.events.length > MAX_EVENTS) {
      state.events = state.events.slice(-MAX_EVENTS);
    }
    this.write(state);
  }

  aggregates(sessionId: string, cwd: string): LedgerAggregates {
    const state = this.read();
    const session = state.sessions[sessionId];
    const today = localDate();
    let dailyUsd = 0;
    let projectUsd = 0;
    for (const rec of Object.values(state.sessions)) {
      if (rec.startDate === today) dailyUsd += rec.costUsd;
      if (cwd && rec.cwd === cwd) projectUsd += rec.costUsd;
    }

    const now = Date.now();
    const samples = state.costSamples ?? [];
    const fiveH = windowSpend(samples, now, FIVE_HOURS_MS);
    const week = windowSpend(samples, now, WEEK_MS);

    return {
      sessionUsd: session?.costUsd ?? 0,
      dailyUsd,
      projectUsd,
      fiveHourUsd: fiveH.total,
      weeklyUsd: week.total,
      fiveHourByClass: fiveH.byClass,
      weeklyByClass: week.byClass,
    };
  }
}

/**
 * Sum API-equivalent spend inside a rolling window from cumulative-cost samples.
 *
 * For each session, window spend = (latest cum ≤ now) − (latest cum ≤ cutoff).
 * Sessions that began inside the window have no pre-cutoff sample, so their
 * baseline is 0 (the whole session counts). This takes real deltas rather than
 * attributing a long session's whole total to whichever window it last touched.
 */
function windowSpend(
  samples: CostSample[],
  now: number,
  windowMs: number,
): { total: number; byClass: Record<string, number> } {
  const cutoff = now - windowMs;
  const bySession = new Map<string, CostSample[]>();
  for (const s of samples) {
    if (s.at > now) continue;
    const arr = bySession.get(s.sessionId);
    if (arr) arr.push(s);
    else bySession.set(s.sessionId, [s]);
  }

  let total = 0;
  const byClass: Record<string, number> = {};
  for (const arr of bySession.values()) {
    arr.sort((a, b) => a.at - b.at);
    const latest = arr[arr.length - 1];
    if (!latest) continue;
    let baseline = 0;
    for (const s of arr) {
      if (s.at <= cutoff) baseline = s.cumUsd;
      else break;
    }
    const delta = Math.max(0, latest.cumUsd - baseline);
    if (delta === 0) continue;
    total += delta;
    const cls = modelClass(latest.modelId);
    byClass[cls] = (byClass[cls] ?? 0) + delta;
  }
  return { total, byClass };
}

/** Convenience factory; hooks and CLI use this so the path stays consistent. */
export function openLedger(): Ledger {
  return new JsonLedger();
}
