import { ReplitConnectors } from "@replit/connectors-sdk";
import type { Subscription } from "@replit/revenuecat-sdk";
import { AiServiceError } from "./groq";

export const MONTHLY_CREDITS = 100;
const connectors = new ReplitConnectors();

export function generationReady() {
  // Opt in only after the owner's API billing and store setup are verified.
  return process.env.OPENAI_IMAGES_ENABLED === "true"
    && !!process.env.OPENAI_API_KEY && !!process.env.PRIVATE_OBJECT_DIR
    && (process.env.NODE_ENV !== "production" || process.env.GOOGLE_PLAY_BILLING_READY === "true");
}

export function selectPremiumSubscription(subscriptions: Subscription[], entitlement: string, production: boolean, allowPlaySandbox = false) {
  const now = Date.now();
  return subscriptions.filter(sub =>
    sub.gives_access && !sub.pending_payment && sub.current_period_starts_at <= now
    && (sub.current_period_ends_at ?? 0) > now
    && sub.entitlements.items.some(item => item.id === entitlement)
    && (!production
      ? ["play_store", "test_store"].includes(sub.store)
      : sub.store === "play_store" && (sub.environment === "production" || (allowPlaySandbox && sub.environment === "sandbox")))
  ).sort((a, b) => b.current_period_starts_at - a.current_period_starts_at)[0] ?? null;
}

export async function subscriptionFor(userId: string): Promise<Subscription | null> {
  const project = process.env.REVENUECAT_PROJECT_ID;
  const entitlement = process.env.REVENUECAT_ENTITLEMENT_ID;
  if (!project || !entitlement) throw new AiServiceError(503, "Premium purchases are not configured yet.");
  const base = `/v2/projects/${encodeURIComponent(project)}/customers/${encodeURIComponent(userId)}`;
  const subscriptions: Subscription[] = [];
  let path: string | null = `${base}/subscriptions?limit=100`;
  while (path) {
    const response = await connectors.proxy("revenuecat", path, { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) throw new AiServiceError(503, "Could not verify your subscription. No credits were used.");
    const data = await response.json() as { items: Subscription[]; next_page?: string | null };
    subscriptions.push(...data.items);
    path = data.next_page ?? null;
  }
  const approvedPlayTester = (process.env.PREMIUM_PLAY_TESTER_IDS ?? "").split(",").map(id => id.trim()).includes(userId);
  return selectPremiumSubscription(subscriptions, entitlement, process.env.NODE_ENV === "production", approvedPlayTester);
}

export function creditPeriodKey(subscription: Subscription) {
  // Store subscription identity, not device/user/calendar month, defines renewals.
  // Transferring a purchase therefore cannot mint another monthly allowance.
  return `${subscription.id}:${subscription.current_period_starts_at}`;
}

export function canUsePaidGeneration(subscription: Subscription, userId: string) {
  const approvedPlayTester = (process.env.PREMIUM_PLAY_TESTER_IDS ?? "").split(",").map(id => id.trim()).includes(userId);
  // Test Store payments are forgeable simulations, even on the public dev server.
  // They must never authorize real OpenAI spending.
  return !!selectPremiumSubscription([subscription], process.env.REVENUECAT_ENTITLEMENT_ID ?? "", true, approvedPlayTester);
}
