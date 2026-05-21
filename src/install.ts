// Idempotent, reversible wiring of tokenwarden into Claude Code's settings.json.
//
// What this does:
//  - registers hook entries for the six events tokenwarden listens on,
//  - sets the statusLine to tokenwarden (unless the user already has one),
//  - can fully reverse itself (uninstall) leaving unrelated config intact.
//
// Cross-platform note: on Windows, Claude Code may run hook commands through
// Git Bash, where backslashes in paths are interpreted as escapes. So the dist
// path written into every `command` string ALWAYS uses forward slashes.
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { HookEventName } from "./types.js";
import { readJsonSafe, writeJsonAtomic } from "./util.js";

// ---------------------------------------------------------------------------
// settings.json shape (only the bits we touch; everything else is preserved)
// ---------------------------------------------------------------------------

interface CommandHook {
  type: "command";
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: CommandHook[];
}

interface StatusLine {
  type: "command";
  command: string;
  padding?: number;
}

/** The subset of settings.json we read/write. Unknown keys pass through. */
interface Settings {
  hooks?: Record<string, HookGroup[]>;
  statusLine?: StatusLine;
  [key: string]: unknown;
}

/** Events tokenwarden registers, with their matcher per the Claude Code schema. */
const HOOK_EVENTS: { event: HookEventName; matcher: string }[] = [
  { event: "SessionStart", matcher: "" },
  { event: "UserPromptSubmit", matcher: "" },
  { event: "PreToolUse", matcher: "*" },
  { event: "PreCompact", matcher: "auto|manual" },
  { event: "Stop", matcher: "" },
  { event: "SessionEnd", matcher: "" },
];

const HOOK_TIMEOUT_S = 10;

export interface InstallOptions {
  /** Explicit settings.json path. Defaults from scope + CLAUDE_CONFIG_DIR. */
  settingsPath?: string;
  /** Absolute path to the running dist/cli.js. Defaults to import.meta.url. */
  distCliPath?: string;
  /** Target the project scope (<cwd>/.claude/settings.json) instead of user. */
  project?: boolean;
  /** Working directory for project scope. Defaults to process.cwd(). */
  cwd?: string;
  /** Overwrite an existing non-tokenwarden statusLine. */
  forceStatusline?: boolean;
}

export interface InstallResult {
  settingsPath: string;
  command: string;
  statuslineCommand: string;
  eventsRegistered: HookEventName[];
  /** True if statusLine was set to tokenwarden by this run. */
  statuslineSet: boolean;
  /** True if a foreign statusLine was left in place. */
  statuslineSkipped: boolean;
}

// ---------------------------------------------------------------------------
// path helpers
// ---------------------------------------------------------------------------

/** The dir Claude Code reads user-scope settings from. Honors CLAUDE_CONFIG_DIR. */
function userClaudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

/** Resolve the settings.json path from the chosen scope. */
export function resolveSettingsPath(opts: InstallOptions): string {
  if (opts.settingsPath) return opts.settingsPath;
  const dir = opts.project
    ? join(opts.cwd ?? process.cwd(), ".claude")
    : userClaudeDir();
  return join(dir, "settings.json");
}

/** The absolute dist/cli.js path, forward-slashed for use inside command strings. */
function resolveDistCli(opts: InstallOptions): string {
  const raw = opts.distCliPath ?? fileURLToPath(import.meta.url);
  return raw.replace(/\\/g, "/");
}

function hookCommand(distCli: string, event: HookEventName): string {
  return `node "${distCli}" hook ${event}`;
}

function statuslineCommand(distCli: string): string {
  return `node "${distCli}" statusline`;
}

// ---------------------------------------------------------------------------
// idempotency: identify entries tokenwarden owns
// ---------------------------------------------------------------------------

// We identify tokenwarden's own entries by the command string rather than by an
// exact path match. The dist path always contains the package name "tokenwarden"
// as a path segment in any realistic install (npm global, npx cache, local node_modules),
// and our commands always end with ` hook <Event>` or ` statusline`. Keying on the
// shape (not the exact current path) means reinstalling via a different path
// (npx vs global) refreshes cleanly instead of leaving orphan entries.
function isTokenwardenCommand(command: string): boolean {
  if (typeof command !== "string") return false;
  if (!command.includes("tokenwarden")) return false;
  return /\bhook\s+\w+\s*$/.test(command) || /\bstatusline\s*$/.test(command);
}

function isTokenwardenStatusLine(sl: StatusLine | undefined): boolean {
  return !!sl && typeof sl.command === "string" && isTokenwardenCommand(sl.command);
}

/**
 * Strip every entry tokenwarden owns from a settings object (mutates + returns).
 * Used by install (to refresh before adding) and uninstall (to remove).
 * Prunes hook groups/arrays that become empty, and the `hooks` key if it empties.
 */
export function removeTokenwardenEntries(settings: Settings): Settings {
  if (settings.hooks && typeof settings.hooks === "object") {
    for (const event of Object.keys(settings.hooks)) {
      const groups = settings.hooks[event];
      if (!Array.isArray(groups)) continue;
      const keptGroups: HookGroup[] = [];
      for (const group of groups) {
        if (!group || !Array.isArray(group.hooks)) {
          keptGroups.push(group);
          continue;
        }
        const keptHooks = group.hooks.filter(
          (h) => !(h && h.type === "command" && isTokenwardenCommand(h.command)),
        );
        if (keptHooks.length > 0) {
          keptGroups.push({ ...group, hooks: keptHooks });
        }
        // group with no remaining hooks is dropped
      }
      if (keptGroups.length > 0) {
        settings.hooks[event] = keptGroups;
      } else {
        delete settings.hooks[event];
      }
    }
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }

  if (isTokenwardenStatusLine(settings.statusLine)) {
    delete settings.statusLine;
  }

  return settings;
}

// ---------------------------------------------------------------------------
// install / uninstall
// ---------------------------------------------------------------------------

export function installHooks(opts: InstallOptions = {}): InstallResult {
  const settingsPath = resolveSettingsPath(opts);
  const distCli = resolveDistCli(opts);

  const settings = readJsonSafe<Settings>(settingsPath, {});
  // Refresh: drop any prior tokenwarden entries so we never duplicate.
  removeTokenwardenEntries(settings);

  // Register hook entries.
  if (!settings.hooks || typeof settings.hooks !== "object") settings.hooks = {};
  const eventsRegistered: HookEventName[] = [];
  for (const { event, matcher } of HOOK_EVENTS) {
    const group: HookGroup = {
      matcher,
      hooks: [
        { type: "command", command: hookCommand(distCli, event), timeout: HOOK_TIMEOUT_S },
      ],
    };
    const existing = settings.hooks[event];
    if (Array.isArray(existing)) {
      existing.push(group);
    } else {
      settings.hooks[event] = [group];
    }
    eventsRegistered.push(event);
  }

  // statusLine: tokenwarden is the most reliable live cost signal, so we want to
  // own it — but never clobber a user's existing statusLine without consent.
  const slCommand = statuslineCommand(distCli);
  let statuslineSet = false;
  let statuslineSkipped = false;
  const existingSl = settings.statusLine;
  if (!existingSl || isTokenwardenStatusLine(existingSl) || opts.forceStatusline) {
    settings.statusLine = { type: "command", command: slCommand, padding: 0 };
    statuslineSet = true;
  } else {
    statuslineSkipped = true;
  }

  writeJsonAtomic(settingsPath, settings);

  return {
    settingsPath,
    command: hookCommand(distCli, "PreToolUse"),
    statuslineCommand: slCommand,
    eventsRegistered,
    statuslineSet,
    statuslineSkipped,
  };
}

export interface UninstallResult {
  settingsPath: string;
  existed: boolean;
}

export function uninstallHooks(opts: InstallOptions = {}): UninstallResult {
  const settingsPath = resolveSettingsPath(opts);
  const existed = existsSync(settingsPath);
  const settings = readJsonSafe<Settings>(settingsPath, {});
  removeTokenwardenEntries(settings);
  writeJsonAtomic(settingsPath, settings);
  return { settingsPath, existed };
}

/** Whether tokenwarden hook entries are present in the given settings file. */
export function hooksInstalled(settingsPath: string): {
  hooksPresent: boolean;
  statuslineOurs: boolean;
  statuslinePresent: boolean;
} {
  const settings = readJsonSafe<Settings>(settingsPath, {});
  let hooksPresent = false;
  if (settings.hooks && typeof settings.hooks === "object") {
    for (const groups of Object.values(settings.hooks)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (group && Array.isArray(group.hooks)) {
          if (group.hooks.some((h) => h && h.type === "command" && isTokenwardenCommand(h.command))) {
            hooksPresent = true;
          }
        }
      }
    }
  }
  return {
    hooksPresent,
    statuslineOurs: isTokenwardenStatusLine(settings.statusLine),
    statuslinePresent: !!settings.statusLine,
  };
}

/** The exact command a user would set as their statusLine to enable live capture. */
export function statuslineHint(opts: InstallOptions = {}): string {
  return statuslineCommand(resolveDistCli(opts));
}
