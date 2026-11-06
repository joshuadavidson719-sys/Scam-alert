import { getWhopClient } from "./whopClient";

export type InstitutionMarket = "ec" | "ca";
export const MANAGE_INSTITUTION_BILLING = "https://whop.com/@me/settings/orders/";

export function institutionConfig(market: InstitutionMarket) {
  return {
    companyId: process.env.WHOP_COMPANY_ID,
    productId: process.env.WHOP_INSTITUTION_PRODUCT_ID,
    planId: market === "ec" ? process.env.WHOP_INSTITUTION_EC_PLAN_ID : process.env.WHOP_INSTITUTION_CA_PLAN_ID,
    currency: market === "ec" ? "xcd" : "cad",
    amount: 2000,
  };
}

export function validateInstitutionPlan(plan: {
  id: string; account: { id: string } | null; product: Record<string, unknown> | null;
  currency: string; renewal_price: number | null; initial_price: number;
  billing_period: number | null; visibility: string; adaptive_pricing_enabled: boolean;
}, config: ReturnType<typeof institutionConfig>) {
  if (!config.companyId || !config.productId || !config.planId ||
      plan.id !== config.planId || plan.account?.id !== config.companyId ||
      plan.product?.id !== config.productId || plan.currency !== config.currency ||
      plan.renewal_price !== config.amount || plan.initial_price !== 0 ||
      plan.billing_period !== 30 || plan.visibility === "archived" ||
      plan.adaptive_pricing_enabled) {
    throw new Error("The institutional plan configuration needs attention.");
  }
}

export function safeWhopCheckoutUrl(value: string | null | undefined): string {
  if (!value) throw new Error("Checkout URL is missing.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "whop.com" || url.port ||
      url.username || url.password || !/^\/checkout\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.hash) {
    throw new Error("Invalid checkout destination.");
  }
  return url.toString();
}

export async function readInstitutionOffer(market: InstitutionMarket) {
  const config = institutionConfig(market);
  if (!config.planId) throw new Error("Institutional billing is not configured.");
  const client = await getWhopClient();
  const plan = await client.variants.retrieve({ id: config.planId });
  validateInstitutionPlan(plan, config);
  return { plan, config, client };
}
