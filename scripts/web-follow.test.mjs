import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../artifacts/scam-alert/lib/follow.web.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(fail = false) {
  const state = new Map([
    ["users/alice", { followers: [], following: [] }],
    ["users/bob", { followers: ["carol"], following: [] }],
  ]);
  let commits = 0;
  const api = {
    arrayUnion: (id) => ({ operation: "add", id }),
    arrayRemove: (id) => ({ operation: "remove", id }),
    doc: (_, collection, id) => `${collection}/${id}`,
    writeBatch() {
      const writes = [];
      return {
        update: (path, value) => writes.push([path, value]),
        async commit() {
          commits++;
          if (fail) throw Object.assign(new Error("Permission denied"), { code: "permission-denied" });
          for (const [path, fields] of writes) {
            for (const [field, change] of Object.entries(fields)) {
              const record = state.get(path);
              record[field] = change.operation === "add"
                ? [...new Set([...record[field], change.id])]
                : record[field].filter((id) => id !== change.id);
            }
          }
        },
      };
    },
  };
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, () => api);
  return { save: (...args) => module.exports.saveWebFollow({}, ...args), state, commits: () => commits };
}

test("follow and unfollow commit both sides and preserve other followers", async () => {
  const app = setup();
  await app.save("alice", "bob", false);
  assert.deepEqual(app.state.get("users/bob").followers, ["carol", "alice"]);
  assert.deepEqual(app.state.get("users/alice").following, ["bob"]);
  await app.save("alice", "bob", true);
  assert.deepEqual(app.state.get("users/bob").followers, ["carol"]);
  assert.deepEqual(app.state.get("users/alice").following, []);
  assert.equal(app.commits(), 2);
});

test("repeated follow is idempotent", async () => {
  const app = setup();
  await app.save("alice", "bob", false);
  await app.save("alice", "bob", false);
  assert.deepEqual(app.state.get("users/bob").followers, ["carol", "alice"]);
});

test("a rejected batch leaves neither side partially updated", async () => {
  const app = setup(true);
  await assert.rejects(app.save("alice", "bob", false), { code: "permission-denied" });
  assert.deepEqual(app.state.get("users/bob").followers, ["carol"]);
  assert.deepEqual(app.state.get("users/alice").following, []);
});

test("self-follow and missing identities are rejected before writes", async () => {
  const app = setup();
  for (const ids of [["alice", "alice"], ["", "bob"], ["alice", ""]]) {
    await assert.rejects(app.save(...ids, false));
  }
  assert.equal(app.commits(), 0);
});
