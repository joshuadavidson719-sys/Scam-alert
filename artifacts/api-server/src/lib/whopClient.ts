import { WhopClient } from "@whop/sdk";

let clientPromise: Promise<WhopClient> | null = null;

async function initWhopClient(): Promise<WhopClient> {
  // Vercel uses a private server-only environment value. Workspace development
  // uses the connected integration; no key is ever shipped to the browser.
  if (process.env.WHOP_API_KEY) {
    return new WhopClient({ token: process.env.WHOP_API_KEY, timeoutInSeconds: 15, maxRetries: 1 });
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL ? `depl ${process.env.WEB_REPL_RENEWAL}` : null;
  if (!hostname || !token) throw new Error("Institutional billing is not configured.");
  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=whop`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error("Institutional billing connection is unavailable.");
  const data = await response.json() as { items?: { settings?: { api_key?: unknown } }[] };
  const apiKey = data.items?.[0]?.settings?.api_key;
  if (typeof apiKey !== "string" || !apiKey) throw new Error("Institutional billing connection is missing.");
  return new WhopClient({ token: apiKey, timeoutInSeconds: 15, maxRetries: 1 });
}

export function getWhopClient(): Promise<WhopClient> {
  if (!clientPromise) clientPromise = initWhopClient().catch((error) => {
    clientPromise = null;
    throw error;
  });
  return clientPromise;
}
