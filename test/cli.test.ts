import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.js";

/** Run a CLI command capturing stdout/stderr; restores streams + cwd after. */
async function capture(
  argv: string[],
  opts: { cwd?: string } = {},
): Promise<{ code: number; out: string; err: string }> {
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  const origCwd = process.cwd();
  let out = "";
  let err = "";
  (process.stdout.write as unknown) = (chunk: any) => {
    out += String(chunk);
    return true;
  };
  (process.stderr.write as unknown) = (chunk: any) => {
    err += String(chunk);
    return true;
  };
  try {
    if (opts.cwd) process.chdir(opts.cwd);
    const code = await run(argv);
    return { code, out, err };
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
    process.chdir(origCwd);
  }
}

function tmpEnv(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "tw-cli-"));
  const prevState = process.env.TOKENWARDEN_STATE_DIR;
  const prevConfig = process.env.CLAUDE_CONFIG_DIR;
  process.env.TOKENWARDEN_STATE_DIR = join(dir, "state");
  process.env.CLAUDE_CONFIG_DIR = join(dir, "claude");
  return {
    dir,
    cleanup: () => {
      if (prevState === undefined) delete process.env.TOKENWARDEN_STATE_DIR;
      else process.env.TOKENWARDEN_STATE_DIR = prevState;
      if (prevConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = prevConfig;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("help routes and prints usage", async () => {
  const r = await capture(["help"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /USAGE/);
  assert.match(r.out, /install\s+Wire tokenwarden hooks/);
});

test("no args defaults to help", async () => {
  const r = await capture([]);
  assert.equal(r.code, 0);
  assert.match(r.out, /USAGE/);
});

test("version prints tokenwarden + a version string", async () => {
  const r = await capture(["version"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /^tokenwarden \d+\.\d+\.\d+/);
});

test("unknown command returns exit code 2 and writes to stderr", async () => {
  const r = await capture(["frobnicate"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown command/);
});

test("install -> status -> doctor -> uninstall round-trip via run()", async () => {
  const env = tmpEnv();
  try {
    const inst = await capture(["install"]);
    assert.equal(inst.code, 0);
    assert.match(inst.out, /installed into/);
    assert.match(inst.out, /observe mode is on/);

    const st = await capture(["status"]);
    assert.equal(st.code, 0);
    assert.match(st.out, /mode:/);
    assert.match(st.out, /estimates/);
    assert.match(st.out, /hooks installed: yes/);

    const doc = await capture(["doctor"]);
    // doctor returns 0 when no FAIL (warnings allowed)
    assert.equal(doc.code, 0);
    assert.match(doc.out, /PASS|WARN/);

    const un = await capture(["uninstall"]);
    assert.equal(un.code, 0);
    assert.match(un.out, /uninstalled|nothing to remove/);
  } finally {
    env.cleanup();
  }
});

test("init writes a starter config and refuses to overwrite without --force", async () => {
  const env = tmpEnv();
  try {
    const first = await capture(["init"], { cwd: env.dir });
    assert.equal(first.code, 0);
    assert.match(first.out, /wrote starter config/);
    assert.ok(existsSync(join(env.dir, ".tokenwarden.json")));

    const second = await capture(["init"], { cwd: env.dir });
    assert.equal(second.code, 1);
    assert.match(second.out, /already exists/);

    const forced = await capture(["init", "--force"], { cwd: env.dir });
    assert.equal(forced.code, 0);
  } finally {
    env.cleanup();
  }
});

test("inspect dumps config + paths", async () => {
  const env = tmpEnv();
  try {
    const r = await capture(["inspect"]);
    assert.equal(r.code, 0);
    assert.match(r.out, /state dir:/);
    assert.match(r.out, /ledger path:/);
    assert.match(r.out, /effective config/);
  } finally {
    env.cleanup();
  }
});

test("report handles no-transcripts / missing modules gracefully", async () => {
  const env = tmpEnv();
  try {
    const r = await capture(["report"]);
    assert.equal(r.code, 0);
    // Either "no transcripts" or "unavailable" depending on whether the
    // accounting modules are built yet — both are graceful, non-throwing.
    assert.match(r.out, /report:|by day|no transcripts|unavailable/i);
  } finally {
    env.cleanup();
  }
});
