// Transcript discovery, parsing, and dedup.
//
// Claude Code stores one JSONL transcript per session under a project root:
//   <projectRoot>/<encoded-cwd>/<session-id>.jsonl
// The folder name is a LOSSY encoding of the cwd (RESEARCH.md §3.1) — recover
// the true cwd from the `cwd` field inside a line, never from the folder name.
//
// Token usage lives ONLY on type:"assistant" lines, under message.usage. One API
// call produces many lines (early streaming undercounts); we DEDUP by requestId
// and keep the line with the largest input_tokens (the finalized one). We do NOT
// sum usage.iterations[] (that double-counts). isSidechain subagent lines ARE
// included — they count toward the parent budget (PLAN §10).
//
// Every function is defensive: malformed files/lines are skipped, never thrown.
import { homedir } from "node:os";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type { CallUsage } from "../types.js";

export interface TranscriptSummary {
  sessionId: string;
  cwd: string;
  calls: CallUsage[];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Lossy folder encoding used by Claude Code for the cwd. */
function encodeCwd(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, "-");
}

/**
 * All candidate Claude Code project roots:
 *   ~/.claude/projects, ~/.config/claude/projects, and each dir listed in
 *   CLAUDE_CONFIG_DIR (comma-separated) with "/projects" appended.
 * Returns paths regardless of existence; callers filter. De-duplicated.
 */
export function findProjectDirs(): string[] {
  const home = homedir();
  const roots: string[] = [
    join(home, ".claude", "projects"),
    join(home, ".config", "claude", "projects"),
  ];

  const env = process.env.CLAUDE_CONFIG_DIR;
  if (env) {
    for (const part of env.split(",")) {
      const dir = part.trim();
      if (dir) roots.push(join(dir, "projects"));
    }
  }

  return [...new Set(roots)];
}

function listJsonlRecursive(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...listJsonlRecursive(full));
    } else if (s.isFile() && name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Locate .jsonl transcript files across all existing project roots.
 *
 * With opts.cwd: prefer the encoded-cwd folder under each root. Because the
 * encoding is lossy, if no transcripts are found in the preferred folders we
 * fall back to scanning every root (parseTranscript recovers the true cwd from
 * line contents so callers can filter precisely). Never throws.
 */
export function findTranscripts(opts?: { cwd?: string }): string[] {
  const roots = findProjectDirs().filter((r) => existsSync(r));

  if (opts?.cwd) {
    const encoded = encodeCwd(opts.cwd);
    const preferred: string[] = [];
    for (const root of roots) {
      const folder = join(root, encoded);
      if (existsSync(folder)) preferred.push(...listJsonlRecursive(folder));
    }
    if (preferred.length > 0) return [...new Set(preferred)];
    // Lossy-encoding fallback: scan everything; caller filters by recovered cwd.
  }

  const all: string[] = [];
  for (const root of roots) all.push(...listJsonlRecursive(root));
  return [...new Set(all)];
}

/** Pull a normalized CallUsage out of one assistant line's message.usage. */
function lineToUsage(
  usage: Record<string, unknown>,
  line: Record<string, unknown>,
): CallUsage {
  // Cache-write split. Use the ephemeral split only when at least one part is
  // present; otherwise attribute all cache_creation to the 5m bucket.
  const cacheCreation = isRecord(usage.cache_creation)
    ? usage.cache_creation
    : undefined;
  const has5m =
    cacheCreation !== undefined &&
    typeof cacheCreation.ephemeral_5m_input_tokens === "number";
  const has1h =
    cacheCreation !== undefined &&
    typeof cacheCreation.ephemeral_1h_input_tokens === "number";

  let cacheWrite5mTokens: number;
  let cacheWrite1hTokens: number;
  if (has5m || has1h) {
    cacheWrite5mTokens = has5m
      ? num(cacheCreation!.ephemeral_5m_input_tokens)
      : 0;
    cacheWrite1hTokens = has1h
      ? num(cacheCreation!.ephemeral_1h_input_tokens)
      : 0;
  } else {
    cacheWrite5mTokens = num(usage.cache_creation_input_tokens);
    cacheWrite1hTokens = 0;
  }

  const serverToolUse = isRecord(usage.server_tool_use)
    ? usage.server_tool_use
    : undefined;
  const webSearchRequests = serverToolUse
    ? num(serverToolUse.web_search_requests)
    : 0;

  // inference_geo and service_tier may sit on the usage object or the line.
  const inferenceGeo =
    str(usage.inference_geo) ?? str(line.inference_geo);
  const serviceTier = str(usage.service_tier) ?? str(line.service_tier);

  // The model id lives on the assistant line's message.model.
  const message = isRecord(line.message) ? line.message : undefined;
  const model = message ? str(message.model) : undefined;

  const call: CallUsage = {
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cacheReadTokens: num(usage.cache_read_input_tokens),
    cacheWrite5mTokens,
    cacheWrite1hTokens,
    webSearchRequests,
  };
  if (model !== undefined) call.model = model;
  if (inferenceGeo !== undefined) call.inferenceGeo = inferenceGeo;
  if (serviceTier !== undefined) call.serviceTier = serviceTier;
  return call;
}

/**
 * Parse one transcript file. Extracts usage from type:"assistant" lines, dedups
 * by top-level requestId (keeping the line with the largest input_tokens), and
 * recovers the true cwd / sessionId from line contents. Corrupt lines are
 * skipped. Returns empty calls (and best-effort identifiers) on any failure.
 */
export function parseTranscript(path: string): TranscriptSummary {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { sessionId: "", cwd: "", calls: [] };
  }

  let sessionId = "";
  let cwd = "";

  // requestId -> chosen CallUsage (the one with max input_tokens so far).
  const byRequest = new Map<string, CallUsage>();
  // Lines without a requestId each count once.
  const anonymous: CallUsage[] = [];

  for (const lineText of raw.split("\n")) {
    const trimmed = lineText.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // skip corrupt line, do not abort the file
    }
    if (!isRecord(parsed)) continue;

    // Recover identifiers opportunistically from any well-formed line.
    if (!sessionId) {
      const sid = str(parsed.sessionId) ?? str(parsed.session_id);
      if (sid) sessionId = sid;
    }
    if (!cwd) {
      const c = str(parsed.cwd);
      if (c) cwd = c;
    }

    if (parsed.type !== "assistant") continue;

    const message = isRecord(parsed.message) ? parsed.message : undefined;
    const usage =
      message && isRecord(message.usage) ? message.usage : undefined;
    if (!usage) continue;

    const call = lineToUsage(usage, parsed);
    const requestId = str(parsed.requestId);

    if (!requestId) {
      anonymous.push(call);
      continue;
    }

    const existing = byRequest.get(requestId);
    // Keep the finalized line: the one with the largest input_tokens.
    if (!existing || call.inputTokens > existing.inputTokens) {
      byRequest.set(requestId, call);
    }
  }

  const calls: CallUsage[] = [...byRequest.values(), ...anonymous];
  return { sessionId, cwd, calls };
}

/**
 * Sum a list of deduped calls into a single CallUsage. Per-call attributes
 * (inferenceGeo, serviceTier) are intentionally dropped — they are not
 * meaningful aggregates. Pricing should be applied per-call before summing USD.
 */
export function sumUsage(calls: CallUsage[]): CallUsage {
  const total: CallUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    webSearchRequests: 0,
  };
  for (const c of calls) {
    total.inputTokens += num(c.inputTokens);
    total.outputTokens += num(c.outputTokens);
    total.cacheReadTokens += num(c.cacheReadTokens);
    total.cacheWrite5mTokens += num(c.cacheWrite5mTokens);
    total.cacheWrite1hTokens += num(c.cacheWrite1hTokens);
    total.webSearchRequests += num(c.webSearchRequests);
  }
  return total;
}
