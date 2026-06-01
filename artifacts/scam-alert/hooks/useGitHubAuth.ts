import { useEffect, useState, useCallback } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const GITHUB_DISCOVERY = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
};

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

export function useGitHubAuth() {
  const { signInWithGitHub } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: ["read:user", "user:email"],
      redirectUri,
    },
    GITHUB_DISCOVERY,
  );

  useEffect(() => {
    if (response?.type !== "success") return;
    const code = response.params.code;
    if (!code) return;

    setLoading(true);
    setError("");

    (async () => {
      try {
        const tokenRes = await fetch(`${BASE}/api/github-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          error?: string;
        };
        if (!tokenData.access_token) {
          throw new Error(tokenData.error ?? "Failed to get GitHub access token");
        }
        await signInWithGitHub(tokenData.access_token);
      } catch (e) {
        setError(e instanceof Error ? e.message : "GitHub sign-in failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [response]);

  const trigger = useCallback(async () => {
    setError("");
    if (!clientId) {
      setError("GitHub sign-in is not configured yet.");
      return;
    }
    await promptAsync({ useProxy: true });
  }, [promptAsync, clientId]);

  return { trigger, loading, error, ready: !!request };
}
