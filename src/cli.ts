// tokenwarden CLI entrypoint (bin: tokenwarden -> dist/cli.js).
//
// Routing is exported as `run(argv)` so it can be unit-tested without spawning a
// process. The bottom of the file calls run() only when executed as the entry.
//
// IMPORTANT: for `hook <Event>` and `statusline`, the CLI must print NOTHING to
// stdout — the hook owns stdout (its JSON decision is the only thing Claude Code
// reads). Only the human-facing command handlers print.
import { fileURLToPath } from "node:url";
import { installHooks, uninstallHooks } from "./install.js";
import {
  status,
  report,
  inspect,
  doctor,
  init,
  readVersion,
} from "./commands.js";

const HELP = `tokenwarden — a token-budget enforcer for Claude Code.
ccusage tells you what you spent; tokenwarden stops you from overspending.

USAGE
  tokenwarden <command> [options]

COMMANDS
  install               Wire tokenwarden hooks + statusLine into settings.json
                          --project          target <cwd>/.claude/settings.json
                          --settings <path>  target an explicit settings file
                          --force-statusline overwrite an existing statusLine
  uninstall             Remove exactly the entries tokenwarden added
                          --project          target the project scope
                          --settings <path>  target an explicit settings file
  status                Show estimated spend vs caps, mode, install state
  report                Retrospective estimated spend (today + last 7 days)
  inspect               Dump effective config, paths, pricing snapshot (debug)
  doctor                Health checks (PASS/WARN/FAIL); non-zero exit on FAIL
  init                  Write a starter .tokenwarden.json to the current dir
                          --force            overwrite an existing file
  help, --help          Show this help
  version, --version    Print the version

All dollar figures are ESTIMATES. tokenwarden defaults to observe mode for safety.`;

function has(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

/** Value of `--flag value` or `--flag=value`, or undefined. */
function flagValue(argv: string[], flag: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return undefined;
}

/** Route argv (already sliced past `node script`). Returns a process exit code. */
export async function run(argv: string[]): Promise<number> {
  const cmd = argv[0];
  const rest = argv.slice(1);

  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP + "\n");
      return 0;

    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`tokenwarden ${readVersion()}\n`);
      return 0;

    case "install": {
      const result = installHooks({
        project: has(rest, "--project"),
        forceStatusline: has(rest, "--force-statusline"),
        settingsPath: flagValue(rest, "--settings"),
      });
      printInstallSummary(result);
      return 0;
    }

    case "uninstall": {
      const result = uninstallHooks({
        project: has(rest, "--project"),
        settingsPath: flagValue(rest, "--settings"),
      });
      process.stdout.write(
        result.existed
          ? `tokenwarden uninstalled from ${result.settingsPath} (unrelated config preserved).\n`
          : `tokenwarden: no settings file at ${result.settingsPath}; nothing to remove.\n`,
      );
      return 0;
    }

    case "status":
      return status();

    case "report":
      return report();

    case "inspect":
      return inspect();

    case "doctor":
      return doctor();

    case "init":
      return init(process.cwd(), has(rest, "--force"));

    case "hook": {
      // Delegate to the hook dispatcher. Print NOTHING here.
      const event = argv[1];
      if (!event) return 0;
      const { dispatchHook } = await import("./hooks/dispatch.js");
      await dispatchHook(event);
      return 0;
    }

    case "statusline": {
      const { dispatchHook } = await import("./hooks/dispatch.js");
      await dispatchHook("statusline");
      return 0;
    }

    default:
      process.stderr.write(
        `tokenwarden: unknown command '${cmd}'. Try 'tokenwarden help'.\n`,
      );
      return 2;
  }
}

function printInstallSummary(result: {
  settingsPath: string;
  statuslineCommand: string;
  eventsRegistered: string[];
  statuslineSet: boolean;
  statuslineSkipped: boolean;
}): void {
  const w = (s: string) => process.stdout.write(s + "\n");
  w(`tokenwarden installed into ${result.settingsPath}`);
  w(`  hooks registered: ${result.eventsRegistered.join(", ")}`);
  if (result.statuslineSet) {
    w("  statusLine: set to tokenwarden (enables reliable live cost capture).");
  } else if (result.statuslineSkipped) {
    w("  statusLine: left your existing one in place.");
    w("    NOTE: live cost capture (the reliable budget signal) works best when");
    w("    tokenwarden is your statusLine. To switch, re-run with --force-statusline,");
    w(`    or set statusLine.command to: ${result.statuslineCommand}`);
  }
  w("");
  w("  observe mode is on for safety; edit .tokenwarden.json and set mode:enforce when ready.");
}

// Execute only when invoked as the bin (not when imported by tests).
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = 1;
    },
  );
}
