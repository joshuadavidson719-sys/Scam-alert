const fs = require("node:fs");
const path = require("node:path");

function readGoogleClientIds() {
  const googleServicesPath = path.join(__dirname, "google-services.json");
  if (!fs.existsSync(googleServicesPath)) {
    return {};
  }

  try {
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, "utf8"));
    const appClient = (googleServices.client || []).find(
      (client) =>
        client.client_info?.android_client_info?.package_name ===
        "com.spicetech.scamalert",
    );
    const oauthClients = appClient?.oauth_client || [];

    return {
      googleAndroidClientId: oauthClients.find((client) => client.client_type === 1)?.client_id,
      googleWebClientId: oauthClients.find((client) => client.client_type === 3)?.client_id,
    };
  } catch {
    return {};
  }
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