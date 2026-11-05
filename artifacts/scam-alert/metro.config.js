const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// Blob's browser aliases are relative to its package root. Metro otherwise
// resolves them relative to dist/client.js, incorrectly adding a second dist/.
const blobBrowserShims = {
  undici: "undici-browser.js",
  crypto: "crypto-browser.js",
  stream: "stream-browser.js",
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    context.originModulePath.replace(/\\/g, "/").includes("/@vercel/blob/") &&
    blobBrowserShims[moduleName]
  ) {
    return {
      type: "sourceFile",
      filePath: path.join(
        path.dirname(require.resolve("@vercel/blob/client")),
        blobBrowserShims[moduleName],
      ),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
