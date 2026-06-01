import { useEffect, useState, useCallback } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const GITHUB_DISCOVERY = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
};

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
      usePKCE: true,
    },
    GITHUB_DISCOVERY,
  );

  useEffect(() => {
    if (response?.type !== "success") return;
    const code = response.params.code;
    const codeVerifier = request?.codeVerifier;
    if (!code) return;

    setLoading(true);
    setError("");

    (async () => {
      try {
        const tokenRes = await fetch(
          "https://github.com/login/oauth/access_token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              client_id: clientId,
              code,
              redirect_uri: redirectUri,
              ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
            }),
          },
        );

        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          error?: string;
          error_description?: string;
        };

        if (!tokenData.access_token) {
          throw new Error(
            tokenData.error_description ??
              tokenData.error ??
              "Could not get GitHub access token",
          );
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
