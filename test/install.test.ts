import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installHooks,
  uninstallHooks,
  removeTokenwardenEntries,
  hooksInstalled,
} from "../src/install.js";

const DIST_CLI = "/opt/global/lib/node_modules/tokenwarden/dist/cli.js";

function tmpSettings(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "tw-install-"));
  const path = join(dir, "settings.json");
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function readSettings(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

const ALL_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PreCompact",
  "Stop",
  "SessionEnd",
];

test("install adds hooks for all 6 events + statusLine on a fresh file", () => {
  const { path, cleanup } = tmpSettings();
  try {
    const result = installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    assert.deepEqual(result.eventsRegistered.sort(), [...ALL_EVENTS].sort());
    assert.equal(result.statuslineSet, true);

    const s = readSettings(path);
    for (const ev of ALL_EVENTS) {
      assert.ok(Array.isArray(s.hooks[ev]), `${ev} group missing`);
      const cmd = s.hooks[ev][0].hooks[0].command;
      assert.match(cmd, new RegExp(`hook ${ev}$`));
      // forward slashes only, even though we'd be on any OS
      assert.ok(!cmd.includes("\\"), "command must use forward slashes");
    }
    assert.equal(s.hooks.PreToolUse[0].matcher, "*");
    assert.equal(s.hooks.SessionStart[0].matcher, "");
    assert.equal(s.hooks.PreCompact[0].matcher, "auto|manual");
    assert.match(s.statusLine.command, /statusline$/);
    assert.equal(s.statusLine.padding, 0);
  } finally {
    cleanup();
  }
});

test("install is idempotent: running twice does not duplicate entries", () => {
  const { path, cleanup } = tmpSettings();
  try {
    installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    const s = readSettings(path);
    for (const ev of ALL_EVENTS) {
      assert.equal(s.hooks[ev].length, 1, `${ev} duplicated`);
      assert.equal(s.hooks[ev][0].hooks.length, 1);
    }
    // statusLine still exactly one tokenwarden entry
    assert.match(s.statusLine.command, /statusline$/);
  } finally {
    cleanup();
  }
});

test("install via a different path refreshes (no orphans)", () => {
  const { path, cleanup } = tmpSettings();
  try {
    installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    const otherPath = "/home/u/.npm/_npx/abc/node_modules/tokenwarden/dist/cli.js";
    installHooks({ settingsPath: path, distCliPath: otherPath });
    const s = readSettings(path);
    for (const ev of ALL_EVENTS) {
      assert.equal(s.hooks[ev].length, 1, `${ev} has orphan`);
      assert.ok(s.hooks[ev][0].hooks[0].command.includes(otherPath));
    }
  } finally {
    cleanup();
  }
});

test("install preserves unrelated hooks and a foreign statusLine (no clobber)", () => {
  const { path, cleanup } = tmpSettings();
  try {
    const preexisting = {
      model: "claude-opus-4-7",
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "node /usr/local/my-linter.js" }],
          },
        ],
      },
      statusLine: { type: "command", command: "node /usr/local/my-statusline.js" },
    };
    writeFileSync(path, JSON.stringify(preexisting), "utf8");

    const result = installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    assert.equal(result.statuslineSet, false);
    assert.equal(result.statuslineSkipped, true);

    const s = readSettings(path);
    // unrelated top-level key preserved
    assert.equal(s.model, "claude-opus-4-7");
    // foreign statusLine untouched
    assert.equal(s.statusLine.command, "node /usr/local/my-statusline.js");
    // foreign PreToolUse hook still present alongside ours
    const cmds = s.hooks.PreToolUse.flatMap((g: any) => g.hooks.map((h: any) => h.command));
    assert.ok(cmds.some((c: string) => c.includes("my-linter.js")));
    assert.ok(cmds.some((c: string) => c.includes("hook PreToolUse")));
  } finally {
    cleanup();
  }
});

test("--force-statusline overwrites a foreign statusLine", () => {
  const { path, cleanup } = tmpSettings();
  try {
    writeFileSync(
      path,
      JSON.stringify({ statusLine: { type: "command", command: "node /x/foreign.js" } }),
      "utf8",
    );
    const result = installHooks({
      settingsPath: path,
      distCliPath: DIST_CLI,
      forceStatusline: true,
    });
    assert.equal(result.statuslineSet, true);
    const s = readSettings(path);
    assert.match(s.statusLine.command, /statusline$/);
  } finally {
    cleanup();
  }
});

test("uninstall removes exactly tokenwarden entries, keeps unrelated", () => {
  const { path, cleanup } = tmpSettings();
  try {
    const preexisting = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "node /usr/local/my-linter.js" }],
          },
        ],
      },
      statusLine: { type: "command", command: "node /usr/local/my-statusline.js" },
    };
    writeFileSync(path, JSON.stringify(preexisting), "utf8");

    installHooks({ settingsPath: path, distCliPath: DIST_CLI, forceStatusline: false });
    uninstallHooks({ settingsPath: path });

    const s = readSettings(path);
    // foreign statusLine remains
    assert.equal(s.statusLine.command, "node /usr/local/my-statusline.js");
    // only the foreign PreToolUse hook remains; no tokenwarden commands anywhere
    const allCmds: string[] = [];
    for (const groups of Object.values(s.hooks ?? {}) as any[]) {
      for (const g of groups) for (const h of g.hooks) allCmds.push(h.command);
    }
    assert.ok(allCmds.some((c) => c.includes("my-linter.js")));
    assert.ok(!allCmds.some((c) => /hook \w+$/.test(c) && c.includes("tokenwarden")));
    // events that were tokenwarden-only are pruned away entirely
    assert.equal(s.hooks.SessionStart, undefined);
  } finally {
    cleanup();
  }
});

test("uninstall on a tokenwarden-only file prunes hooks + statusLine to empty", () => {
  const { path, cleanup } = tmpSettings();
  try {
    installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    uninstallHooks({ settingsPath: path });
    const s = readSettings(path);
    assert.equal(s.hooks, undefined);
    assert.equal(s.statusLine, undefined);
  } finally {
    cleanup();
  }
});

test("missing settings file is handled (install starts from {})", () => {
  const { path, cleanup } = tmpSettings();
  try {
    // file does not exist yet
    const result = installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    assert.equal(result.eventsRegistered.length, 6);
    const ins = hooksInstalled(path);
    assert.equal(ins.hooksPresent, true);
    assert.equal(ins.statuslineOurs, true);
  } finally {
    cleanup();
  }
});

test("malformed settings file is handled gracefully", () => {
  const { path, cleanup } = tmpSettings();
  try {
    writeFileSync(path, "{ this is not valid json ", "utf8");
    const result = installHooks({ settingsPath: path, distCliPath: DIST_CLI });
    assert.equal(result.eventsRegistered.length, 6);
    const s = readSettings(path);
    assert.ok(s.hooks.PreToolUse);
  } finally {
    cleanup();
  }
});

test("removeTokenwardenEntries leaves a non-tokenwarden object untouched", () => {
  const obj = {
    hooks: {
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "node /other.js" }] }],
    },
    statusLine: { type: "command", command: "node /other-sl.js" },
  } as any;
  const before = JSON.stringify(obj);
  removeTokenwardenEntries(obj);
  assert.equal(JSON.stringify(obj), before);
});
