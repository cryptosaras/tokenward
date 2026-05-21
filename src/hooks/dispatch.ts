// Single hook entrypoint. The CLI calls dispatchHook(argv[3]) for
// `tokenwarden hook <Event>` and dispatchHook("statusline") for the statusline.
//
// Responsibilities (kept thin so handlers stay unit-testable):
//   1. env kill-switches (DISABLE / FORCE)
//   2. read stdin once, parse JSON fail-open
//   3. loadConfig(cwd) + openLedger()
//   4. route by name to the right handler, inside runHook (fail-open + timeout)
import { loadConfig } from "../config.js";
import { openLedger } from "../accounting/ledger.js";
import { readStdin, parseJsonSafe } from "../util.js";
import { runHook } from "./_wrap.js";
import type {
  HookOutput,
  PreCompactInput,
  PreToolUseInput,
  SessionEndInput,
  SessionStartInput,
  StatuslineInput,
  StopInput,
  UserPromptSubmitInput,
} from "../types.js";
import { handlePreToolUse, type HandlerOpts } from "./pretool.js";
import { handleUserPromptSubmit } from "./prompt-submit.js";
import { handlePreCompact } from "./precompact.js";
import { handleSessionStart, handleSessionFinalize } from "./session.js";
import { handleStatusline } from "./statusline.js";

interface RawInput {
  cwd?: string;
  [k: string]: unknown;
}

/**
 * Reads stdin, parses JSON (fail-open), routes by hook event name (or the
 * literal "statusline"), and runs the handler via runHook. Never throws.
 */
export async function dispatchHook(name: string): Promise<void> {
  // Kill-switch: disabled entirely -> do nothing (proceed, print nothing).
  if (process.env.TOKENWARDEN_DISABLE === "1") return;

  await runHook(async () => {
    const raw = await readStdin();
    const input = parseJsonSafe<RawInput>(raw, {});
    const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();

    const config = loadConfig(cwd);
    const ledger = openLedger();
    const opts: HandlerOpts = { force: process.env.TOKENWARDEN_FORCE === "1" };

    // Statusline is a special route: it prints a status line to stdout directly
    // and returns no HookOutput. Capture runs in all modes.
    if (name === "statusline") {
      const line = handleStatusline(input as StatuslineInput, config, ledger);
      process.stdout.write(line + "\n");
      return null;
    }

    return route(name, input, config, ledger, opts);
  });
}

function route(
  name: string,
  input: RawInput,
  config: ReturnType<typeof loadConfig>,
  ledger: ReturnType<typeof openLedger>,
  opts: HandlerOpts,
): HookOutput | null {
  switch (name) {
    case "PreToolUse":
      return handlePreToolUse(input as unknown as PreToolUseInput, config, ledger, opts);
    case "UserPromptSubmit":
      return handleUserPromptSubmit(input as unknown as UserPromptSubmitInput, config, ledger, opts);
    case "PreCompact":
      return handlePreCompact(input as unknown as PreCompactInput, config, ledger, opts);
    case "SessionStart":
      return handleSessionStart(input as unknown as SessionStartInput, config, ledger);
    case "SessionEnd":
      return handleSessionFinalize(input as unknown as SessionEndInput, config, ledger);
    case "Stop":
      return handleSessionFinalize(input as unknown as StopInput, config, ledger);
    default:
      // Unknown event (incl. PostToolUse, which we don't act on) -> proceed.
      return null;
  }
}
