import { createHash, randomBytes } from "node:crypto";

// Create and immediately remove a synthetic Firebase Auth account. No email is
// sent, no real user or passkey is read, and the JWT is never printed or saved.
let config;
const raw = process.env.EXPO_PUBLIC_FIREBASE_CONFIG ?? "";
try { config = JSON.parse(raw); }
catch {
  const read = name => raw.match(new RegExp(`${name}\\s*:\\s*["']([^"']+)["']`))?.[1];
  config = {
    apiKey: read("apiKey") ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    projectId: read("projectId") ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  };
}
if (!config.apiKey || !config.projectId) throw new Error("Firebase public configuration is incomplete.");
if (JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ?? "{}").project_id !== config.projectId) {
  throw new Error("The server credential belongs to a different Firebase project.");
}
const suffix = randomBytes(12).toString("hex");
const signup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `passkey-rule-check-${suffix}@example.com`, password: randomBytes(32).toString("base64url"), returnSecureToken: true }),
});
if (!signup.ok) throw new Error(`The synthetic permission check could not sign in (${signup.status}).`);
const account = await signup.json();
const key = createHash("sha256").update(`passkey-rule-check-${suffix}`).digest("hex");
const collections = [
  "_institutionPasskeyAccounts", "_institutionPasskeyChallenges", "_institutionPasskeyApprovals",
  "_institutionPasskeyCredentialOwners", "_institutionPasskeyLimits",
];
const unexpectedWrites = [];
try {
  let safe = true;
  for (const collection of collections) {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${collection}/${key}`;
    const headers = { Authorization: `Bearer ${account.idToken}`, "Content-Type": "application/json" };
    const read = await fetch(url, { headers });
    const write = await fetch(`${url}?currentDocument.exists=false`, {
      method: "PATCH", headers, body: JSON.stringify({ fields: { securityProbe: { booleanValue: true } } }),
    });
    if (write.ok) unexpectedWrites.push(url);
    console.log(JSON.stringify({ collection, readStatus: read.status, writeStatus: write.status }));
    safe &&= read.status === 403 && write.status === 403;
  }
  if (!safe) throw new Error("Firebase client rules do not protect every passkey collection. Do not enable checkout.");
} finally {
  // Self-delete any probe that unexpected client permissions allowed.
  for (const url of unexpectedWrites) {
    await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${account.idToken}` } });
  }
  const deleted = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: account.idToken }),
  });
  if (!deleted.ok) throw new Error("Synthetic account cleanup failed. No credentials have been printed.");
  console.log("Synthetic permission-check account removed.");
}
