import { createHash } from "node:crypto";
import { AiServiceError } from "../groq";
import { institutionConfig, type InstitutionMarket } from "../institutionBilling";

export const MAX_PASSKEYS = 5;
export const CHALLENGE_LIFETIME_MS = 5 * 60_000;
export const APPROVAL_LIFETIME_MS = 2 * 60_000;
export const RECOVERY_MESSAGE = "Add a backup passkey on another device. If all passkeys are lost, contact Scam Alert support for manual identity review. An email or password reset does not remove passkey protection.";
export type PasskeyContext = { uid: string; authTime: number; origin: string; rpId: string };
export type CheckoutIntent = { market: InstitutionMarket; institutionName: string; requestId: string; acceptedBillingTerms: boolean };
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const accountId = (context: PasskeyContext) => hash(`${context.rpId}\0${context.uid}`);
export const publicUserId = (context: PasskeyContext) => new Uint8Array(createHash("sha256").update(`passkey-user\0${context.uid}\0${context.rpId}`).digest());

export function actionBinding(context: PasskeyContext, purpose: "checkout" | "enroll", intent?: CheckoutIntent) {
  if (purpose === "enroll") return hash(JSON.stringify([context.uid, context.origin, "enroll"]));
  if (!intent || intent.acceptedBillingTerms !== true) throw new AiServiceError(400, "Review your institution and billing terms before approving checkout.");
  const config = institutionConfig(intent.market);
  return hash(JSON.stringify([
    context.uid, context.origin, purpose, intent.market, intent.institutionName.trim(),
    intent.requestId, config.planId, config.currency, config.amount, "institution-30day-2000",
  ]));
}

export function requireBoundRecord(
  record: { uid: string; authTime: number; origin: string; rpId: string; expiresAt: number } | undefined,
  context: PasskeyContext,
  now = Date.now(),
) {
  if (!record || record.uid !== context.uid || record.authTime !== context.authTime ||
      record.origin !== context.origin || record.rpId !== context.rpId ||
      !Number.isFinite(record.expiresAt) || record.expiresAt <= now) {
    throw new AiServiceError(403, "Passkey approval is missing, expired or belongs to another session. Please approve again.");
  }
}
