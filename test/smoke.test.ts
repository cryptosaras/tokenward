import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate } from "../src/util.js";
test("smoke: tsx loader resolves .js->.ts and runs", () => {
  assert.match(localDate(0), /^\d{4}-\d{2}-\d{2}$/);
});
