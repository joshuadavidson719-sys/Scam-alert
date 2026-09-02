const fs = require("node:fs");
const path = require("node:path");

function parseGoogleServices(rawValue) {
  const raw = rawValue.trim();
  const candidates = [raw];

  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    candidates.push(raw.slice(1, -1));
  }

  candidates.push(raw.replace(/\\n/g, "\n").replace(/\\"/g, '"'));

  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    candidates.push(Buffer.from(raw.replace(/\s/g, ""), "base64").toString("utf8"));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "string") {
        const nested = JSON.parse(parsed);
        if (nested && typeof nested === "object") {
          return nested;
        }
      } else if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Try the next supported secret format.
    }
  }

  throw new Error(
    "google-services.json is not valid JSON, escaped JSON, or Base64-encoded JSON.",
  );
}

function readGoogleClientIds() {
  const googleServicesPath = path.join(__dirname, "google-services.json");
  if (!fs.existsSync(googleServicesPath)) {
    return {};
  }

  let googleServices;
  try {
    googleServices = parseGoogleServices(
      fs.readFileSync(googleServicesPath, "utf8"),
    );
  } catch {
    return {};
  }

  fs.writeFileSync(
    googleServicesPath,
    `${JSON.stringify(googleServices, null, 2)}\n`,
  );

  const appClient = (googleServices.client || []).find(
    (client) =>
      client.client_info?.android_client_info?.package_name ===
      "com.spicetech.scamalert",
  );
  const oauthClients =
    appClient?.oauth_client ||
    googleServices.client?.flatMap((client) => client.oauth_client || []) ||
    [];

  return {
    googleAndroidClientId: oauthClients.find((client) => client.client_type === 1)?.client_id,
    googleWebClientId: oauthClients.find((client) => client.client_type === 3)?.client_id,
  };
}

module.exports = ({ config }) => {
  const googleClientIds = readGoogleClientIds();

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      ...googleClientIds,
    },
  };
};