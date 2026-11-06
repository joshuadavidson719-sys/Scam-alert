import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(path, dependencies = {}) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  });
  return module.exports;
}
const policy = load("../artifacts/api-server/src/lib/institutionBilling.ts", {
  "./whopClient": { getWhopClient: () => { throw new Error("Not used in policy tests"); } },
});
const config = { companyId: "biz_test", productId: "prod_test", planId: "plan_test", currency: "xcd", amount: 2000 };
const plan = {
  id: "plan_test", account: { id: "biz_test" }, product: { id: "prod_test" },
  currency: "xcd", renewal_price: 2000, initial_price: 0, billing_period: 30,
  visibility: "hidden", adaptive_pricing_enabled: false,
};

test("accepts exact recurring plan, with no additional setup charge", () => {
  assert.doesNotThrow(() => policy.validateInstitutionPlan(plan, config));
});
test("rejects changed amount, currency, owner, product, interval and setup charge", () => {
  for (const patch of [
    { renewal_price: 5000 }, { currency: "usd" }, { account: { id: "biz_other" } },
    { product: { id: "prod_other" } }, { id: "plan_other" }, { billing_period: 365 },
    { initial_price: 2000 }, { visibility: "archived" }, { adaptive_pricing_enabled: true },
  ]) assert.throws(() => policy.validateInstitutionPlan({ ...plan, ...patch }, config));
  assert.throws(() => policy.validateInstitutionPlan(plan, { ...config, planId: undefined }));
});
test("only HTTPS Whop hosted checkout can be returned to a client", () => {
  assert.equal(policy.safeWhopCheckoutUrl("https://whop.com/checkout/plan_test"), "https://whop.com/checkout/plan_test");
  for (const bad of [null, undefined, "", "http://whop.com/checkout/x", "https://whop.com.evil.test/checkout/x", "https://evil.test/checkout/x", "https://whop.com/@me/settings/orders/", "https://user:password@whop.com/checkout/x", "https://whop.com:8443/checkout/x", "https://whop.com/checkout/x#fake", "https://whop.com/checkout//other"]) {
    assert.throws(() => policy.safeWhopCheckoutUrl(bad));
  }
});
const regions = load("../artifacts/scam-alert/constants/institutionPlans.ts");
test("country prices match the user's revised institutional offering", () => {
  const xcd = regions.INSTITUTION_REGIONS.filter(r => r.currency === "XCD");
  assert.equal(xcd.length, 8);
  assert.ok(xcd.every(r => r.monthly === 2000));
  assert.equal(regions.INSTITUTION_REGIONS.find(r => r.id === "ca").monthly, 2000);
  assert.ok(regions.INSTITUTION_REGIONS.filter(r => r.status !== "set").every(r => r.monthly === null));
});
test("checkout request body rejects forged consent, unsupported markets and malformed retries", () => {
  const schema = load("../lib/api-zod/src/generated/api.ts", { zod: require("zod") }).CreateInstitutionCheckoutBody;
  const valid = { market: "ec", institutionName: "Test Credit Union", acceptedBillingTerms: true, requestId: "12345678-abcd-abcd-abcd-123456789abc", passkeyApproval: "A".repeat(43) };
  assert.equal(schema.safeParse(valid).success, true);
  for (const patch of [{ market: "us" }, { acceptedBillingTerms: false }, { institutionName: "A" }, { requestId: "bad" }]) {
    assert.equal(schema.safeParse({ ...valid, ...patch }).success, false);
  }
});

// createRequire is used only for the installed Zod package in the generated schema.
import { createRequire } from "node:module";
const require = createRequire(new URL("../lib/api-zod/package.json", import.meta.url));
class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const security = load("../artifacts/api-server/src/lib/institutionSecurity.ts", {
  "./groq": { AiServiceError: ServiceError },
});
const validBody = {
  market: "ec", institutionName: "Test Credit Union", acceptedBillingTerms: true,
  requestId: "12345678-abcd-4bcd-8bcd-123456789abc", passkeyApproval: "A".repeat(43),
};
test("bank checkout requires a verified email and recent real authentication", () => {
  const valid = { sub: "test-representative", email_verified: true, auth_time: 1000 };
  assert.equal(security.requireBillingIdentity(valid, 1100), valid.sub);
  for (const patch of [{ sub: "" }, { email_verified: false }, { email_verified: "true" }, { auth_time: undefined }, { auth_time: 0 }, { auth_time: 1200 }, { auth_time: Infinity }]) {
    assert.throws(() => security.requireBillingIdentity({ ...valid, ...patch }, 1100));
  }
});
test("checkout only accepts exact configured HTTPS website origins", () => {
  const env = { NODE_ENV: "production", INSTITUTION_WEBSITE_ORIGIN: "https://app.example.com", VERCEL_URL: "own-preview.vercel.app", REPLIT_DEV_DOMAIN: "ignored.replit.dev" };
  assert.equal(security.isAllowedBillingOrigin("https://app.example.com", env), true);
  assert.equal(security.isAllowedBillingOrigin("https://own-preview.vercel.app", env), true);
  for (const origin of [undefined, "null", "http://app.example.com", "https://app.example.com.evil.test", "https://app.example.com/path", "https://app.example.com:8443", "https://attacker.vercel.app", "https://ignored.replit.dev"]) {
    assert.equal(security.isAllowedBillingOrigin(origin, env), false);
  }
});
test("rejects extra client pricing, spoofed ownership, hidden controls and invalid retry UUIDs", () => {
  assert.equal(security.isStrictCheckoutBody(validBody), true);
  for (const patch of [{ amount: 1 }, { currency: "usd" }, { firebase_uid: "other" }, { institutionName: "Bank\u202eevil" }, { institutionName: "Bank\nName" }, { requestId: "12345678-abcd-abcd-abcd-123456789abc" }]) {
    assert.equal(security.isStrictCheckoutBody({ ...validBody, ...patch }), false);
  }
});

const schemas = load("../lib/api-zod/src/generated/api.ts", { zod: require("zod") });
async function exerciseCheckout({ origin = "https://app.example.com", body = validBody, claims, dsLevel = "mandate_challenge", unavailable = false, passkeyOkay = true } = {}) {
  let checkoutCalls = 0;
  const calls = [];
  let handlers;
  const router = {
    get() {},
    post(_path, ...middleware) { handlers = middleware; },
  };
  load("../artifacts/api-server/src/routes/institutions.ts", {
    express: { Router: () => router },
    "express-rate-limit": { rateLimit: () => (_req, _res, next) => next() },
    "node:crypto": require("node:crypto"),
    "@workspace/api-zod": schemas,
    "../lib/firebaseIdentity": { verifiedIdentity: async () => {
      if (!claims) throw new ServiceError(401, "Sign in to continue.");
      return claims;
    } },
    "../lib/groq": { AiServiceError: ServiceError },
    "../lib/passkeys/service": {
      InstitutionPasskeys: class {
        async approveCheckout() { if (!passkeyOkay) throw new ServiceError(403, "Passkey approval is required."); }
      },
    },
    "../lib/institutionSecurity": {
      ...security,
      isAllowedBillingOrigin: value => security.isAllowedBillingOrigin(value, { INSTITUTION_WEBSITE_ORIGIN: "https://app.example.com" }),
    },
    "../lib/institutionBilling": {
      ...policy,
      readInstitutionOffer: async () => {
        if (unavailable) throw Error("Provider is down");
        return {
          plan: { id: "plan_test" }, config: { companyId: "biz_test", currency: "xcd", amount: 2000 },
          client: { checkoutConfigurations: { create: async (request, options) => {
            checkoutCalls++;
            calls.push({ request, options });
            return { id: "ch_test", purchase_url: "https://whop.com/checkout/ch_test/", three_ds_level: dsLevel };
          } } },
        };
      },
    },
  });
  const req = { body, get: name => name === "Origin" ? origin : undefined, is: type => type === "application/json", log: { warn() {}, info() {} } };
  const res = { locals: {}, code: 200, body: undefined, setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  return { status: res.code, body: res.body, checkoutCalls, calls };
}
test("route rejects spoofed origins, missing sign-in, unverified email and expired identity before creating checkout", async () => {
  const fresh = { sub: "test-user", email_verified: true, auth_time: Date.now() / 1000 };
  for (const [options, expected] of [
    [{ origin: "https://attacker.example" }, 403],
    [{}, 401],
    [{ claims: { ...fresh, email_verified: false } }, 403],
    [{ claims: { ...fresh, auth_time: 1 } }, 401],
    [{ claims: fresh, body: { ...validBody, amount: 1 } }, 400],
    [{ claims: fresh, body: { ...validBody, passkeyApproval: undefined } }, 400],
    [{ claims: fresh, passkeyOkay: false }, 403],
  ]) {
    const result = await exerciseCheckout(options);
    assert.equal(result.status, expected);
    assert.equal(result.checkoutCalls, 0);
  }
});
test("verified checkout requests issuer challenge, fixed provider plan and deterministic retry protection", async () => {
  const before = process.env.INSTITUTION_WEBSITE_ORIGIN;
  process.env.INSTITUTION_WEBSITE_ORIGIN = "https://app.example.com";
  try {
    const claims = { sub: "test-user", email_verified: true, auth_time: Date.now() / 1000 };
    const first = await exerciseCheckout({ claims });
    const repeat = await exerciseCheckout({ claims });
    assert.equal(first.status, 200);
    assert.equal(first.calls[0].request.three_ds_level, "mandate_challenge");
    assert.equal(first.calls[0].request.metadata.firebase_uid, "test-user");
    assert.equal(first.calls[0].request.variant_id, "plan_test");
    assert.equal(first.calls[0].options.idempotencyKey, repeat.calls[0].options.idempotencyKey);
    assert.equal(first.body.purchaseUrl, "https://whop.com/checkout/ch_test/");
    assert.equal(first.body.paid, undefined);
    const unconfirmed = await exerciseCheckout({ claims, dsLevel: null });
    assert.equal(unconfirmed.status, 200);
    assert.equal(unconfirmed.body.paid, undefined);
    assert.equal((await exerciseCheckout({ claims, unavailable: true })).status, 503);
  } finally {
    if (before === undefined) delete process.env.INSTITUTION_WEBSITE_ORIGIN;
    else process.env.INSTITUTION_WEBSITE_ORIGIN = before;
  }
});
