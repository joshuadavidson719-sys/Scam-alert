import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  GetInstitutionPasskeysResponse, StartInstitutionPasskeyRegistrationBody,
  StartInstitutionPasskeyRegistrationResponse, FinishInstitutionPasskeyRegistrationBody,
  FinishInstitutionPasskeyRegistrationResponse, StartInstitutionPasskeyApprovalBody,
  StartInstitutionPasskeyApprovalResponse, FinishInstitutionPasskeyApprovalBody,
  FinishInstitutionPasskeyApprovalResponse,
} from "@workspace/api-zod";
import { verifiedIdentity } from "../lib/firebaseIdentity";
import { isAllowedBillingOrigin, isStrictCheckoutBody, requireBillingIdentity } from "../lib/institutionSecurity";
import { AiServiceError } from "../lib/groq";
import { InstitutionPasskeys } from "../lib/passkeys/service";
import { PasskeyStore } from "../lib/passkeys/store";
import type { PasskeyContext } from "../lib/passkeys/policy";

const router = Router();
const limit = rateLimit({
  windowMs: 15 * 60_000, limit: 50, standardHeaders: "draft-7", legacyHeaders: false,
  keyGenerator: (_req, res) => res.locals.uid,
  message: { error: "Too many passkey attempts. Wait a few minutes before trying again." },
});
router.use("/institutions/passkeys", async (req, res, next): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  let origin = req.get("Origin");
  if (!origin && req.method === "GET") {
    try { origin = new URL(req.get("Referer") ?? "").origin; } catch { /* Fail closed below. */ }
  }
  if (!isAllowedBillingOrigin(origin)) {
    res.status(403).json({ error: "Open passkey settings from the official Scam Alert website." }); return;
  }
  if (req.method !== "GET" && (!req.is("application/json") || JSON.stringify(req.body ?? null).length > 64_000)) {
    res.status(400).json({ error: "Invalid passkey request." }); return;
  }
  try {
    const identity = await verifiedIdentity(req);
    const uid = requireBillingIdentity(identity!);
    res.locals.uid = uid;
    res.locals.passkeyContext = { uid, authTime: identity!.auth_time, origin, rpId: new URL(origin!).hostname };
    if (req.method !== "GET") await new PasskeyStore().limitAttempt(res.locals.passkeyContext as PasskeyContext);
    next();
  } catch (error) {
    res.status(error instanceof AiServiceError ? error.status : 503).json({
      error: error instanceof AiServiceError ? error.message : "Account verification is temporarily unavailable.",
    });
  }
}, limit);
const service = (res: { locals: Record<string, unknown> }) => new InstitutionPasskeys(res.locals.passkeyContext as PasskeyContext);
function invalidKeys(body: unknown, keys: string[]) {
  return !body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key));
}
function fail(error: unknown, req: Parameters<typeof verifiedIdentity>[0], res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  if (!(error instanceof AiServiceError)) req.log.warn("Protected institutional passkey operation unavailable");
  res.status(error instanceof AiServiceError ? error.status : 503).json({
    error: error instanceof AiServiceError ? error.message : "Passkey verification is temporarily unavailable. Checkout remains locked.",
  });
}
router.get("/institutions/passkeys/status", async (req, res): Promise<void> => {
  try { res.json(GetInstitutionPasskeysResponse.parse(await service(res).status())); }
  catch (error) { fail(error, req, res); }
});
router.post("/institutions/passkeys/register/options", async (req, res): Promise<void> => {
  const parsed = StartInstitutionPasskeyRegistrationBody.safeParse(req.body);
  if (!parsed.success || invalidKeys(req.body, ["managementApproval"])) { res.status(400).json({ error: "Invalid passkey enrollment request." }); return; }
  try {
    res.json(StartInstitutionPasskeyRegistrationResponse.parse(await service(res).registrationOptions(parsed.data.managementApproval)));
  } catch (error) { fail(error, req, res); }
});
router.post("/institutions/passkeys/register/verify", async (req, res): Promise<void> => {
  const parsed = FinishInstitutionPasskeyRegistrationBody.safeParse(req.body);
  if (!parsed.success || invalidKeys(req.body, ["challengeId", "credential"])) { res.status(400).json({ error: "Invalid passkey response." }); return; }
  try {
    res.json(FinishInstitutionPasskeyRegistrationResponse.parse(await service(res).register(
      parsed.data.challengeId, parsed.data.credential as unknown as RegistrationResponseJSON,
    )));
  } catch (error) { fail(error, req, res); }
});
router.post("/institutions/passkeys/authenticate/options", async (req, res): Promise<void> => {
  const parsed = StartInstitutionPasskeyApprovalBody.safeParse(req.body);
  if (!parsed.success || invalidKeys(req.body, ["purpose", "checkout"]) ||
      (parsed.data.purpose === "checkout" && !isStrictCheckoutBody(req.body.checkout, false)) ||
      (parsed.data.purpose === "enroll" && parsed.data.checkout !== undefined)) {
    res.status(400).json({ error: "Review the checkout details before approving." }); return;
  }
  try {
    res.json(StartInstitutionPasskeyApprovalResponse.parse(await service(res).authenticationOptions(parsed.data.purpose, parsed.data.checkout)));
  } catch (error) { fail(error, req, res); }
});
router.post("/institutions/passkeys/authenticate/verify", async (req, res): Promise<void> => {
  const parsed = FinishInstitutionPasskeyApprovalBody.safeParse(req.body);
  if (!parsed.success || invalidKeys(req.body, ["challengeId", "credential"])) { res.status(400).json({ error: "Invalid passkey response." }); return; }
  try {
    res.json(FinishInstitutionPasskeyApprovalResponse.parse(await service(res).authenticate(
      parsed.data.challengeId, parsed.data.credential as unknown as AuthenticationResponseJSON,
    )));
  } catch (error) { fail(error, req, res); }
});
export default router;
