import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request } from "express";
import { AiServiceError } from "./groq";

const keys = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
));

function projectId() {
  if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const config = process.env.EXPO_PUBLIC_FIREBASE_CONFIG ?? "";
  try {
    return JSON.parse(config).projectId as string | undefined;
  } catch {
    // Also support the Firebase console's JavaScript config snippet.
    return config.match(/projectId\s*:\s*["']([^"']+)["']/)?.[1];
  }
}

export async function verifiedUser(req: Request, optional = false): Promise<string | null> {
  const header = req.get("Authorization");
  if (!header && optional) return null;
  if (!header?.startsWith("Bearer ")) throw new AiServiceError(401, "Sign in to continue.");
  const project = projectId();
  if (!project || project === "placeholder-project") throw new AiServiceError(503, "Account verification is not configured.");
  try {
    const { payload } = await jwtVerify(header.slice(7), keys, {
      algorithms: ["RS256"], audience: project, issuer: `https://securetoken.google.com/${project}`,
      requiredClaims: ["sub", "exp", "iat"],
    });
    if (!payload.sub || payload.sub.length > 128 || (payload.iat ?? Infinity) > Date.now() / 1000 + 60) throw new Error("Invalid identity");
    return payload.sub;
  } catch {
    throw new AiServiceError(401, "Your session has expired. Sign in again.");
  }
}
