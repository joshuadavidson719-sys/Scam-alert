import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { AiServiceError } from "../groq";

let db: Firestore | null = null;
export function passkeyDatabase(): Firestore {
  if (db) return db;
  try {
    const credential = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ?? "");
    let configuredProject = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    if (!configuredProject) {
      const config = process.env.EXPO_PUBLIC_FIREBASE_CONFIG ?? "";
      try { configuredProject = JSON.parse(config).projectId; }
      catch { configuredProject = config.match(/projectId\s*:\s*["']([^"']+)["']/)?.[1]; }
    }
    if (credential.type !== "service_account" || !configuredProject ||
        credential.project_id !== configuredProject ||
        typeof credential.private_key !== "string" || typeof credential.client_email !== "string") {
      throw new Error("Credential missing or mismatched");
    }
    const name = "institution-passkeys";
    const app = getApps().find(candidate => candidate.name === name) ??
      initializeApp({ credential: cert(credential), projectId: configuredProject }, name);
    const firestore = getFirestore(app);
    firestore.settings({ preferRest: true });
    db = firestore;
    return db;
  } catch {
    throw new AiServiceError(503, "Protected passkey storage is not configured. Institutional checkout is unavailable.");
  }
}
