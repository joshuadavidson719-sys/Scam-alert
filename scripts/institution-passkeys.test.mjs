import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import ts from "typescript";

const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const webauthn = await import(pathToFileURL(require.resolve("@simplewebauthn/server")).href);
const { isoCBOR } = await import(pathToFileURL(require.resolve("@simplewebauthn/server/helpers")).href);
function load(path, deps) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, name => {
    if (name.startsWith("node:")) return require(name);
    if (!(name in deps)) throw Error(`Unexpected test dependency: ${name}`);
    return deps[name];
  });
  return module.exports;
}
class ServiceError extends Error { constructor(status, message) { super(message); this.status = status; } }
const policy = load("../artifacts/api-server/src/lib/passkeys/policy.ts", {
  "../groq": { AiServiceError: ServiceError },
  "../institutionBilling": { institutionConfig: market => ({ planId: `plan_${market}`, currency: market === "ec" ? "xcd" : "cad", amount: 2000 }) },
});
const { PasskeyStore } = load("../artifacts/api-server/src/lib/passkeys/store.ts", {
  "firebase-admin/firestore": { Timestamp: { fromMillis: ms => ms } },
  "../groq": { AiServiceError: ServiceError }, "./policy": policy,
  "./admin": { passkeyDatabase: () => { throw Error("Tests must use the isolated store"); } },
});
const { InstitutionPasskeys } = load("../artifacts/api-server/src/lib/passkeys/service.ts", {
  "@simplewebauthn/server": webauthn, "../groq": { AiServiceError: ServiceError },
  "./policy": policy, "./store": { PasskeyStore },
});

// Serial transactions emulate shared Firestore atomicity, not per-process
// approval flags. None of these fixtures touch Firebase or create real users.
class MemoryFirestore {
  docs = new Map();
  tail = Promise.resolve();
  collection(name) {
    return { doc: id => this.ref(`${name}/${id}`) };
  }
  ref(path) {
    return {
      path, get: async () => this.snapshot(path),
      create: async value => { if (this.docs.has(path)) throw Error("already exists"); this.docs.set(path, structuredClone(value)); },
    };
  }
  snapshot(path) {
    return { exists: this.docs.has(path), data: () => structuredClone(this.docs.get(path)) };
  }
  runTransaction(work) {
    const next = this.tail.then(async () => {
      const writes = [];
      const result = await work({
        get: async ref => this.snapshot(ref.path),
        set: (ref, value) => writes.push(() => this.docs.set(ref.path, structuredClone(value))),
        update: (ref, value) => writes.push(() => this.docs.set(ref.path, { ...this.docs.get(ref.path), ...structuredClone(value) })),
        create: (ref, value) => writes.push(() => {
          if (this.docs.has(ref.path)) throw Error("already exists");
          this.docs.set(ref.path, structuredClone(value));
        }),
        delete: ref => writes.push(() => this.docs.delete(ref.path)),
      });
      for (const write of writes) write();
      return result;
    });
    this.tail = next.catch(() => {});
    return next;
  }
}
const context = { uid: "synthetic-passkey-user", authTime: 1000, origin: "https://app.example.com", rpId: "app.example.com" };
const intent = { market: "ec", institutionName: "Synthetic Test Credit Union", requestId: "12345678-abcd-4bcd-8bcd-123456789abc", acceptedBillingTerms: true };
function setup(ctx = context, db = new MemoryFirestore()) {
  const store = new PasskeyStore(db);
  return { db, store, service: new InstitutionPasskeys(ctx, store) };
}
const digest = data => createHash("sha256").update(data).digest();
const b64 = data => Buffer.from(data).toString("base64url");
function clientData(challenge, type, origin = context.origin) {
  return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
}
function registration(options, { origin = context.origin, uv = true } = {}) {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = keys.publicKey.export({ format: "jwk" });
  const idBytes = randomBytes(32);
  const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))], [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))]]);
  const length = Buffer.alloc(2); length.writeUInt16BE(idBytes.length);
  const authenticatorData = Buffer.concat([
    digest(options.rp.id), Buffer.from([uv ? 0x45 : 0x41]), Buffer.alloc(4),
    Buffer.alloc(16), length, idBytes, Buffer.from(isoCBOR.encode(cose)),
  ]);
  const attestation = isoCBOR.encode(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", new Uint8Array(authenticatorData)]]));
  return {
    privateKey: keys.privateKey, id: b64(idBytes), userHandle: options.user.id,
    response: {
      id: b64(idBytes), rawId: b64(idBytes), type: "public-key",
      response: { clientDataJSON: b64(clientData(options.challenge, "webauthn.create", origin)), attestationObject: b64(attestation), transports: ["internal"] },
      clientExtensionResults: {}, authenticatorAttachment: "platform",
    },
  };
}
function assertion(options, key, { origin = context.origin, uv = true, counter = 1, corrupt = false } = {}) {
  const count = Buffer.alloc(4); count.writeUInt32BE(counter);
  const auth = Buffer.concat([digest(options.rpId), Buffer.from([uv ? 0x05 : 0x01]), count]);
  const data = clientData(options.challenge, "webauthn.get", origin);
  const signature = sign("sha256", Buffer.concat([auth, digest(data)]), key.privateKey);
  if (corrupt) signature[0] ^= 1;
  return {
    id: key.id, rawId: key.id, type: "public-key", authenticatorAttachment: "platform", clientExtensionResults: {},
    response: { clientDataJSON: b64(data), authenticatorData: b64(auth), signature: b64(signature), userHandle: key.userHandle },
  };
}
async function enroll(s) {
  const start = await s.service.registrationOptions();
  const key = registration(start.options);
  const status = await s.service.register(start.challengeId, key.response);
  assert.equal(status.count, 1);
  return key;
}
test("real WebAuthn registration, signed approval and one-use checkout consumption", async () => {
  const s = setup();
  const key = await enroll(s);
  const start = await s.service.authenticationOptions("checkout", intent);
  assert.equal(start.options.userVerification, "required");
  const result = await s.service.authenticate(start.challengeId, assertion(start.options, key));
  assert.equal(result.purpose, "checkout");
  await s.service.approveCheckout(result.approvalToken, intent);
  await assert.rejects(() => s.service.approveCheckout(result.approvalToken, intent), /missing|expired/);
});
test("registration rejects missing device verification and foreign origin", async () => {
  for (const options of [{ uv: false }, { origin: "https://attacker.example" }]) {
    const s = setup();
    const start = await s.service.registrationOptions();
    await assert.rejects(() => s.service.register(start.challengeId, registration(start.options, options).response), /could not be verified/);
    assert.equal((await s.service.status()).count, 0);
  }
});
test("signature, origin, user-verification flag and signature counter cannot be forged", async () => {
  const s = setup();
  const key = await enroll(s);
  for (const options of [{ uv: false }, { corrupt: true }, { origin: "https://attacker.example" }]) {
    const start = await s.service.authenticationOptions("checkout", intent);
    await assert.rejects(() => s.service.authenticate(start.challengeId, assertion(start.options, key, options)), /could not be verified/);
    await assert.rejects(() => s.service.authenticate(start.challengeId, assertion(start.options, key)), /missing|expired/);
  }
  const good = await s.service.authenticationOptions("checkout", intent);
  await s.service.authenticate(good.challengeId, assertion(good.options, key, { counter: 2 }));
  const cloned = await s.service.authenticationOptions("checkout", intent);
  await assert.rejects(() => s.service.authenticate(cloned.challengeId, assertion(cloned.options, key, { counter: 1 })), /could not be verified/);
});
test("an approval is bound to user, website, auth session and exact checkout details", async () => {
  const s = setup();
  const key = await enroll(s);
  const start = await s.service.authenticationOptions("checkout", intent);
  const result = await s.service.authenticate(start.challengeId, assertion(start.options, key));
  for (const change of [{ uid: "different-user" }, { authTime: 1001 }, { origin: "https://other.example" }, { rpId: "other.example" }]) {
    const other = setup({ ...context, ...change }, s.db);
    await assert.rejects(() => other.service.approveCheckout(result.approvalToken, intent), /missing|expired/);
  }
  for (const change of [{ market: "ca" }, { institutionName: "Different institution" }, { requestId: "different" }]) {
    await assert.rejects(() => s.service.approveCheckout(result.approvalToken, { ...intent, ...change }), /does not match/);
  }
  await s.service.approveCheckout(result.approvalToken, intent);
});
test("concurrent replay can create only one approval", async () => {
  const s = setup();
  const key = await enroll(s);
  const start = await s.service.authenticationOptions("checkout", intent);
  const response = assertion(start.options, key);
  const results = await Promise.allSettled([
    s.service.authenticate(start.challengeId, response), s.service.authenticate(start.challengeId, response),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
});
test("adding a backup requires an existing passkey; an enrollment approval cannot buy", async () => {
  const s = setup();
  const key = await enroll(s);
  await assert.rejects(() => s.service.registrationOptions(), /existing passkey/);
  const start = await s.service.authenticationOptions("enroll");
  const approval = await s.service.authenticate(start.challengeId, assertion(start.options, key));
  await assert.rejects(() => s.service.approveCheckout(approval.approvalToken, intent), /does not match/);
  const enrollment = await s.service.registrationOptions(approval.approvalToken);
  await s.service.register(enrollment.challengeId, registration(enrollment.options).response);
  assert.equal((await s.service.status()).count, 2);
});
test("concurrent first enrollments cannot bypass the existing-key requirement", async () => {
  const s = setup();
  const [first, second] = await Promise.all([s.service.registrationOptions(), s.service.registrationOptions()]);
  await s.service.register(first.challengeId, registration(first.options).response);
  await assert.rejects(() => s.service.register(second.challengeId, registration(second.options).response), /settings changed/);
  assert.equal((await s.service.status()).count, 1);
});
test("expired challenges and approvals remain locked", async () => {
  const s = setup();
  const key = await enroll(s);
  const expired = await s.service.authenticationOptions("checkout", intent);
  s.db.docs.get(`_institutionPasskeyChallenges/${policy.hash(expired.challengeId)}`).expiresAt = 0;
  await assert.rejects(() => s.service.authenticate(expired.challengeId, assertion(expired.options, key)), /missing|expired/);
  const start = await s.service.authenticationOptions("checkout", intent);
  const result = await s.service.authenticate(start.challengeId, assertion(start.options, key));
  s.db.docs.get(`_institutionPasskeyApprovals/${policy.hash(result.approvalToken)}`).expiresAt = 0;
  await assert.rejects(() => s.service.approveCheckout(result.approvalToken, intent), /missing|expired/);
});
test("valid synced passkeys with a zero signature counter remain usable", async () => {
  const s = setup();
  const key = await enroll(s);
  for (let use = 0; use < 2; use++) {
    const start = await s.service.authenticationOptions("checkout", intent);
    const result = await s.service.authenticate(start.challengeId, assertion(start.options, key, { counter: 0 }));
    await s.service.approveCheckout(result.approvalToken, intent);
  }
});
test("attempt limits are shared across instances and website scopes", async () => {
  const s = setup();
  const other = setup({ ...context, origin: "https://preview.example.com", rpId: "preview.example.com" }, s.db);
  const results = await Promise.allSettled(Array.from({ length: 51 }, (_, index) =>
    (index % 2 ? s : other).store.limitAttempt(index % 2 ? context : { ...context, rpId: "preview.example.com" }),
  ));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 50);
  assert.equal(results.find(result => result.status === "rejected").reason.status, 429);
});
