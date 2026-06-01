import { useEffect, useState, useCallback } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

const GITHUB_DISCOVERY = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
};

// In Expo Go the custom URI scheme isn't registered with the OS, so we must
// use the Expo auth proxy (HTTPS) as the redirect target. In a real build the
// app's own scheme (scamalert://) is registered and works natively.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const redirectUri = AuthSession.makeRedirectUri(
  isExpoGo
    ? { useProxy: true }
    : { scheme: "scamalert", path: "oauth" },
);

export function useGitHubAuth() {
  const { signInWithGitHub, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        router.replace("/(tabs)/" as never);
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
    await promptAsync(isExpoGo ? { useProxy: true } : {});
  }, [promptAsync, clientId]);

  return { trigger, loading, error, ready: !!request };
}
