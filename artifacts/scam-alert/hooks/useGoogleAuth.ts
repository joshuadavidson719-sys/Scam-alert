import { useCallback, useState } from "react";
import { Platform, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";

export function useGoogleAuth() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trigger = useCallback(async () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Google Sign-In",
        "Google Sign-In is available on the web app. Open the web version to sign in with Google.",
        [{ text: "OK" }]
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      router.replace("/(tabs)/" as never);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled")) {
        setError("");
      } else if (msg.includes("account-exists-with-different-credential")) {
        setError("An account already exists with this email. Try a different sign-in method.");
      } else if (msg.includes("popup-blocked")) {
        setError("Popup was blocked. Please allow popups for this site and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [signInWithGoogle]);

  return { trigger, loading, error };
}
