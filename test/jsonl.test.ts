import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseTranscript,
  sumUsage,
  findProjectDirs,
} from "../src/accounting/jsonl.js";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "tw-jsonl-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("parseTranscript: dedup keeps max input_tokens per requestId", () => {
  withTempDir((dir) => {
    const path = join(dir, "session-abc.jsonl");
    const lines = [
      // FINAL line first — proves we keep MAX, not last.
      JSON.stringify({
        type: "assistant",
        requestId: "req-1",
        sessionId: "sess-1",
        cwd: "E:\\A_develop\\Github\\tokenwarden",
        message: {
          usage: {
            input_tokens: 5000,
            output_tokens: 800,
            cache_read_input_tokens: 200,
            cache_creation: {
              ephemeral_5m_input_tokens: 100,
              ephemeral_1h_input_tokens: 50,
            },
          },
        },
      }),
      // EARLY streaming line — undercounted; must be discarded.
      JSON.stringify({
        type: "assistant",
        requestId: "req-1",
        message: { usage: { input_tokens: 12, output_tokens: 3 } },
      }),
      // Non-assistant line — ignored entirely.
      JSON.stringify({
        type: "user",
        message: { content: "hi", usage: { input_tokens: 999999 } },
      }),
      // Sidechain subagent line, distinct requestId — INCLUDED.
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        requestId: "req-2",
        message: {
          usage: {
            input_tokens: 2000,
            output_tokens: 400,
            cache_creation_input_tokens: 300,
          },
        },
      }),
      // Corrupt line — skipped, must not crash.
      "{ this is not json",
      "",
    ];
    writeFileSync(path, lines.join("\n"), "utf8");

    const summary = parseTranscript(path);

    assert.equal(summary.sessionId, "sess-1");
    assert.equal(summary.cwd, "E:\\A_develop\\Github\\tokenwarden");
    // req-1 (deduped) + req-2 (sidechain) = 2 calls. user line ignored.
    assert.equal(summary.calls.length, 2);

    const req1 = summary.calls.find((c) => c.inputTokens === 5000);
    assert.ok(req1, "kept the finalized req-1 line");
    assert.equal(req1.outputTokens, 800);
    assert.equal(req1.cacheReadTokens, 200);
    assert.equal(req1.cacheWrite5mTokens, 100);
    assert.equal(req1.cacheWrite1hTokens, 50);

    // Sidechain line counted; its cache_creation (no split) falls into 5m.
    const req2 = summary.calls.find((c) => c.inputTokens === 2000);
    assert.ok(req2, "sidechain line included");
    assert.equal(req2.cacheWrite5mTokens, 300);
    assert.equal(req2.cacheWrite1hTokens, 0);
  });
});

test("parseTranscript: captures message.model on each call (needed to price report)", () => {
  withTempDir((dir) => {
    const path = join(dir, "session-model.jsonl");
    const lines = [
      JSON.stringify({
        type: "assistant",
        requestId: "r1",
        message: { model: "claude-opus-4-7", usage: { input_tokens: 100, output_tokens: 10 } },
      }),
      JSON.stringify({
        type: "assistant",
        requestId: "r2",
        message: { model: "claude-haiku-4-5", usage: { input_tokens: 50, output_tokens: 5 } },
      }),
    ];
    writeFileSync(path, lines.join("\n"), "utf8");

    const summary = parseTranscript(path);
    const models = summary.calls.map((c) => c.model).sort();
    assert.deepEqual(models, ["claude-haiku-4-5", "claude-opus-4-7"]);
  });
});

test("parseTranscript: lines without requestId each count once", () => {
  withTempDir((dir) => {
    const path = join(dir, "s.jsonl");
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: { usage: { input_tokens: 10, output_tokens: 1 } },
      }),
      JSON.stringify({
        type: "assistant",
        message: { usage: { input_tokens: 20, output_tokens: 2 } },
      }),
    ];
    writeFileSync(path, lines.join("\n"), "utf8");
    const summary = parseTranscript(path);
    assert.equal(summary.calls.length, 2);
  });
});

test("parseTranscript: inference_geo and web search captured (line or usage)", () => {
  withTempDir((dir) => {
    const path = join(dir, "g.jsonl");
    const lines = [
      JSON.stringify({
        type: "assistant",
        requestId: "r-geo",
        // inference_geo on the line, not under usage.
        inference_geo: "us",
        message: {
          usage: {
            input_tokens: 100,
            service_tier: "standard",
            server_tool_use: { web_search_requests: 4 },
          },
        },
      }),
    ];
    writeFileSync(path, lines.join("\n"), "utf8");
    const summary = parseTranscript(path);
    assert.equal(summary.calls.length, 1);
    const call = summary.calls[0]!;
    assert.equal(call.inferenceGeo, "us");
    assert.equal(call.serviceTier, "standard");
    assert.equal(call.webSearchRequests, 4);
  });
});

test("parseTranscript: missing file returns safe empty summary", () => {
  const summary = parseTranscript(join(tmpdir(), "does-not-exist-xyz.jsonl"));
  assert.deepEqual(summary, { sessionId: "", cwd: "", calls: [] });
});

test("sumUsage: totals tokens and drops per-call attributes", () => {
  const total = sumUsage([
    {
      inputTokens: 100,
      outputTokens: 10,
      cacheReadTokens: 5,
      cacheWrite5mTokens: 2,
      cacheWrite1hTokens: 1,
      webSearchRequests: 3,
      inferenceGeo: "us",
    },
    {
      inputTokens: 200,
      outputTokens: 20,
      cacheReadTokens: 10,
      cacheWrite5mTokens: 4,
      cacheWrite1hTokens: 2,
      webSearchRequests: 1,
    },
  ]);
  assert.equal(total.inputTokens, 300);
  assert.equal(total.outputTokens, 30);
  assert.equal(total.cacheReadTokens, 15);
  assert.equal(total.cacheWrite5mTokens, 6);
  assert.equal(total.cacheWrite1hTokens, 3);
  assert.equal(total.webSearchRequests, 4);
  assert.equal(total.inferenceGeo, undefined);
  assert.equal(total.serviceTier, undefined);
});

test("sumUsage: empty list yields zeros", () => {
  const total = sumUsage([]);
  assert.equal(total.inputTokens, 0);
  assert.equal(total.webSearchRequests, 0);
});

test("findProjectDirs: includes the two default roots", () => {
  const dirs = findProjectDirs();
  assert.ok(dirs.some((d) => d.replace(/\\/g, "/").endsWith(".claude/projects")));
  assert.ok(
    dirs.some((d) => d.replace(/\\/g, "/").endsWith(".config/claude/projects")),
  );
});
