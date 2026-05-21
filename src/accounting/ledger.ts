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
  SessionRecord,
  StatuslineSnapshot,
} from "../types.js";
import { stateDir, readJsonSafe, writeJsonAtomic, localDate } from "../util.js";

const LEDGER_VERSION = 1;
const MAX_EVENTS = 500;

function emptyState(): LedgerState {
  return { version: LEDGER_VERSION, sessions: {}, events: [] };
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
    return {
      sessionUsd: session?.costUsd ?? 0,
      dailyUsd,
      projectUsd,
    };
  }
}

/** Convenience factory; hooks and CLI use this so the path stays consistent. */
export function openLedger(): Ledger {
  return new JsonLedger();
}
