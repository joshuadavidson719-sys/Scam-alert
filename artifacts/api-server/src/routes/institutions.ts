import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";
import {
  CreateInstitutionCheckoutBody,
  CreateInstitutionCheckoutResponse,
  GetInstitutionBillingResponse,
} from "@workspace/api-zod";
import { verifiedIdentity } from "../lib/firebaseIdentity";
import { isAllowedBillingOrigin, isStrictCheckoutBody, requireBillingIdentity } from "../lib/institutionSecurity";
import { AiServiceError } from "../lib/groq";
import { InstitutionPasskeys } from "../lib/passkeys/service";
import type { PasskeyContext } from "../lib/passkeys/policy";
import {
  readInstitutionOffer, MANAGE_INSTITUTION_BILLING, safeWhopCheckoutUrl,
} from "../lib/institutionBilling";

const router = Router();
const catalogLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
const checkoutLimit = rateLimit({
  windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false,
  keyGenerator: (_req, res) => res.locals.uid,
  message: { error: "Too many checkout requests. Wait a few minutes and try again." },
});

router.get("/institutions/billing", catalogLimit, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const offers = await Promise.all((["ec", "ca"] as const).map(async market => {
      const { plan, config } = await readInstitutionOffer(market);
      return {
        market, available: true, currency: config.currency.toUpperCase(),
        amount: plan.renewal_price!, billingDays: plan.billing_period!,
        formattedPrice: plan.formatted_price,
        message: "Renews every 30 days. Taxes, if applicable, are shown at checkout. Cancel future renewals in Whop Orders.",
      };
    }));
    res.json(GetInstitutionBillingResponse.parse({ offers, manageUrl: MANAGE_INSTITUTION_BILLING }));
  } catch {
    req.log.warn("Institutional billing catalogue unavailable");
    res.status(503).json({ error: "Institutional billing is temporarily unavailable. No payment has been taken." });
  }
});

router.post("/institutions/checkout", async (req, res, next): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!isAllowedBillingOrigin(req.get("Origin"))) {
    res.status(403).json({ error: "Institutional checkout must be opened from the official Scam Alert website." });
    return;
  }
  if (!req.is("application/json") || !isStrictCheckoutBody(req.body)) {
    res.status(400).json({ error: "Invalid institutional checkout request." });
    return;
  }
  try {
    const identity = await verifiedIdentity(req);
    res.locals.uid = requireBillingIdentity(identity!);
    res.locals.passkeyContext = {
      uid: res.locals.uid, authTime: identity!.auth_time as number, origin: req.get("Origin")!,
      rpId: new URL(req.get("Origin")!).hostname,
    } satisfies PasskeyContext;
    next();
  } catch (error) {
    res.status(error instanceof AiServiceError ? error.status : 503).json({
      error: error instanceof AiServiceError ? error.message : "Could not verify your account.",
    });
  }
}, checkoutLimit, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = CreateInstitutionCheckoutBody.safeParse(req.body);
  if (!parsed.success || parsed.data.institutionName.trim().length < 2 || parsed.data.acceptedBillingTerms !== true) {
    res.status(400).json({ error: "Enter your institution's name and accept the recurring billing terms." });
    return;
  }
  try {
    const { plan, config, client } = await readInstitutionOffer(parsed.data.market);
    const origin = new URL(process.env.INSTITUTION_WEBSITE_ORIGIN ?? "");
    if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("Website configuration missing.");
    const uid = res.locals.uid as string;
    await new InstitutionPasskeys(res.locals.passkeyContext as PasskeyContext)
      .approveCheckout(parsed.data.passkeyApproval, parsed.data);
    const idempotencyKey = createHash("sha256").update([
      uid, parsed.data.requestId, plan.id, parsed.data.institutionName.trim(),
    ].join(":")).digest("hex");
    const checkout = await client.checkoutConfigurations.create({
      account_id: config.companyId,
      variant_id: plan.id,
      three_ds_level: "mandate_challenge",
      redirect_url: `${origin.origin}/institutions?checkout_returned=1`,
      metadata: {
        firebase_uid: uid,
        institution_name: parsed.data.institutionName.trim(),
        market: parsed.data.market,
        billing_terms_version: "institution-30day-2000",
        security_policy: "verified-email-recent-auth-passkey",
        issuer_challenge_requested: true,
      },
    }, { idempotencyKey });
    // Some Whop API versions return null here even when a challenge was
    // requested. This field is NOT proof of issuer authentication or payment.
    // Whop/issuer still owns card acceptance; the app grants no paid access.
    res.json(CreateInstitutionCheckoutResponse.parse({
      purchaseUrl: safeWhopCheckoutUrl(checkout.purchase_url),
      checkoutId: checkout.id,
    }));
    req.log.info({
      event: "institution_checkout_created",
      accountRef: createHash("sha256").update(uid).digest("hex").slice(0, 16),
      market: parsed.data.market, currency: config.currency, amount: config.amount,
    }, "Hosted institutional checkout created with issuer authentication requested");
    // Hosted Whop checkout owns payment identity, receipts and cancellation.
    // Nothing here grants an app entitlement or trusts the return URL as paid.
  } catch (error) {
    req.log.warn("Institutional hosted checkout unavailable");
    res.status(error instanceof AiServiceError ? error.status : 503).json({
      error: error instanceof AiServiceError ? error.message : "Checkout could not be opened. No payment was taken by this app. Please try again.",
    });
  }
});

export default router;
