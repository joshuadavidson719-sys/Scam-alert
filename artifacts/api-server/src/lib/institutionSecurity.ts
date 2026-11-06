import { AiServiceError } from "./groq";

export const BILLING_AUTH_MAX_AGE = 15 * 60;

export function requireBillingIdentity(
  claims: { sub?: string; email_verified?: unknown; auth_time?: unknown },
  now = Date.now() / 1000,
) {
  if (!claims.sub || claims.email_verified !== true) {
    throw new AiServiceError(403, "Verify your account email before opening institutional checkout.");
  }
  if (typeof claims.auth_time !== "number" || !Number.isFinite(claims.auth_time) ||
      claims.auth_time > now + 60 || now - claims.auth_time > BILLING_AUTH_MAX_AGE) {
    throw new AiServiceError(401, "Confirm your identity again before opening institutional checkout.");
  }
  return claims.sub;
}

function httpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      parsed.pathname === "/" && !parsed.search && !parsed.hash ? parsed.origin : null;
  } catch { return null; }
}

export function billingOrigins(env: NodeJS.ProcessEnv = process.env) {
  const candidates = [
    env.INSTITUTION_WEBSITE_ORIGIN,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    ...(env.NODE_ENV === "development" ? [
      env.REPLIT_EXPO_DEV_DOMAIN ? `https://${env.REPLIT_EXPO_DEV_DOMAIN}` : undefined,
      env.REPLIT_DEV_DOMAIN ? `https://${env.REPLIT_DEV_DOMAIN}` : undefined,
    ] : []),
  ];
  return new Set(candidates.map(httpsOrigin).filter((value): value is string => value !== null));
}

export function isAllowedBillingOrigin(origin: string | undefined, env = process.env) {
  return !!origin && origin === httpsOrigin(origin) && billingOrigins(env).has(origin);
}

export function isStrictCheckoutBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  const allowed = ["market", "institutionName", "acceptedBillingTerms", "requestId"];
  return Object.keys(value).length === allowed.length &&
    Object.keys(value).every(key => allowed.includes(key)) &&
    typeof value.institutionName === "string" &&
    value.institutionName.trim().length >= 2 && value.institutionName.length <= 150 &&
    // Reject hidden bidi/control characters that can disguise the merchant name.
    !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value.institutionName) &&
    typeof value.requestId === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.requestId);
}
