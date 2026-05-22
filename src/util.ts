// Shared, dependency-free utilities: paths, atomic IO, formatting.
import { homedir } from "node:os";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

/** tokenwarden's own state directory (ledger, captured snapshots). */
export function stateDir(): string {
  return process.env.TOKENWARDEN_STATE_DIR ?? join(homedir(), ".tokenwarden");
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Read and parse a JSON file, returning `fallback` on any error. */
export function readJsonSafe<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write JSON atomically: write a temp file in the same directory, then rename.
 * rename is atomic on the same filesystem, so a crash never leaves a half-file.
 */
export function writeJsonAtomic(path: string, value: unknown): void {
  const dir = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  if (dir) ensureDir(dir);
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, path);
}

/** Local calendar date as YYYY-MM-DD (used for daily budget windows). */
export function localDate(epochMs: number = Date.now()): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Coarse model family from a model id, for per-class usage windows. Anthropic's
 * Nov-2025 update gave Sonnet and Opus independent weekly limits, so we bucket
 * spend by class even though v1 enforces one combined ceiling.
 */
export function modelClass(modelId: string | undefined): string {
  const id = (modelId ?? "").toLowerCase();
  if (id.includes("opus")) return "opus";
  if (id.includes("sonnet")) return "sonnet";
  if (id.includes("haiku")) return "haiku";
  return "other";
}

/** Format USD for human-facing reasons. Always prefixed to read as an estimate. */
export function usd(n: number): string {
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

/** Read all of stdin as a string (hooks receive their payload here). */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

/** Parse JSON, returning fallback on error (never throws). */
export function parseJsonSafe<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
