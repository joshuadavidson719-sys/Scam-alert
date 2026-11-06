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
  for (const bad of [null, undefined, "", "http://whop.com/checkout/x", "https://whop.com.evil.test/checkout/x", "https://evil.test/checkout/x", "https://whop.com/@me/settings/orders/"]) {
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
  const valid = { market: "ec", institutionName: "Test Credit Union", acceptedBillingTerms: true, requestId: "12345678-abcd-abcd-abcd-123456789abc" };
  assert.equal(schema.safeParse(valid).success, true);
  for (const patch of [{ market: "us" }, { acceptedBillingTerms: false }, { institutionName: "A" }, { requestId: "bad" }]) {
    assert.equal(schema.safeParse({ ...valid, ...patch }).success, false);
  }
});

// createRequire is used only for the installed Zod package in the generated schema.
import { createRequire } from "node:module";
const require = createRequire(new URL("../lib/api-zod/package.json", import.meta.url));
