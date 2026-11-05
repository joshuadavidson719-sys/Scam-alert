import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";

const source = readFileSync(
  new URL("../artifacts/scam-alert/lib/utils.web.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(
  module, module.exports, createRequire(import.meta.url),
);
const { toDisplayDate, formatTimeAgo, generateId } = module.exports;
const millis = Date.parse("2026-11-05T10:57:00Z");

test("Firestore SDK timestamps display their actual saved date", () => {
  assert.equal(toDisplayDate({ toDate: () => new Date(millis) }).getTime(), millis);
});

test("serialized Firestore timestamps retain seconds and nanoseconds", () => {
  for (const value of [
    { seconds: millis / 1000, nanoseconds: 123000000 },
    { _seconds: millis / 1000, _nanoseconds: 123000000 },
  ]) assert.equal(toDisplayDate(value).getTime(), millis + 123);
});

test("numeric, Date and ISO values remain supported", () => {
  for (const value of [millis, new Date(millis), new Date(millis).toISOString()]) {
    assert.equal(toDisplayDate(value).getTime(), millis);
    assert.equal(formatTimeAgo(value), formatTimeAgo({ seconds: millis / 1000 }));
    assert.match(formatTimeAgo(value), /2026/);
    assert.doesNotMatch(formatTimeAgo(value), /Invalid Date/);
  }
});

test("missing, pending and malformed dates never fabricate a posting date", () => {
  for (const value of [
    null, undefined, "", "bad date", {}, NaN, Infinity,
    { seconds: NaN }, new Date(NaN),
    { toDate() { throw new Error("unresolved"); } },
  ]) {
    assert.equal(toDisplayDate(value), null);
    assert.equal(formatTimeAgo(value), "Date unavailable");
  }
});

test("native formatter is unchanged and web retains identifier generation", () => {
  const native = readFileSync(
    new URL("../artifacts/scam-alert/lib/utils.ts", import.meta.url), "utf8",
  );
  assert.match(native, /if \(seconds < 60\) return "just now"/);
  assert.equal(typeof generateId(), "string");
});
