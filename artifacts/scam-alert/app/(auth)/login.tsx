import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, firebaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/" as never);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      const msg = e instanceof Error ? e.message : "";
      if (
        code.includes("invalid-credential") ||
        code.includes("wrong-password") ||
        code.includes("invalid-password") ||
        msg.includes("invalid-credential") ||
        msg.includes("wrong-password")
      ) {
        setError("Invalid email or password. Please check and try again.");
      } else if (
        code.includes("user-not-found") ||
        msg.includes("user-not-found")
      ) {
        setError("No account found with this email. Please sign up first.");
      } else if (
        code.includes("too-many-requests") ||
        msg.includes("too-many-requests")
      ) {
        setError("Too many failed attempts. Please wait a moment and try again.");
      } else if (
        code.includes("network-request-failed") ||
        msg.includes("network-request-failed") ||
        msg.includes("network")
      ) {
        setError("Network error. Check your internet connection and try again.");
      } else if (
        code.includes("user-disabled") ||
        msg.includes("suspended")
      ) {
        setError(msg || "Your account has been suspended. Contact support.");
      } else if (
        code.includes("invalid-email") ||
        msg.includes("invalid-email")
      ) {
        setError("Please enter a valid email address.");
      } else {
        setError(`Login failed: ${code || msg || "Unknown error. Please try again."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <Text style={[styles.appName, { color: colors.text }]}>Scam Alert</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Stay informed. Stay safe.
          </Text>
        </View>

        {!firebaseConfigured && (
          <View style={[styles.warningBanner, { backgroundColor: colors.warning + "22", borderColor: colors.warning }]}>
            <Text style={{ fontSize: 14, color: colors.warning }}>⚠️</Text>
            <Text style={[styles.warningText, { color: colors.warning }]}>
              Firebase not configured. Please add your Firebase credentials in app settings.
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome back</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}>
              <Text style={{ fontSize: 14, color: colors.destructive }}>⚠️</Text>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ fontSize: 16, color: colors.textMuted }}>📧</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ fontSize: 16, color: colors.textMuted }}>🔒</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>{showPassword ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/(auth)/signup" as never)}
          >
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Don't have an account?{" "}
            </Text>
            <Text style={[styles.link, { color: colors.primary }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", gap: 6, marginTop: 32 }}>
          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            All content is user-submitted and for awareness purposes only.
          </Text>
          <TouchableOpacity onPress={() => router.push("/tos" as never)}>
            <Text style={[styles.disclaimer, { color: colors.primary }]}>
              Terms of Service · Privacy Policy · DMCA
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 22,
    marginBottom: 16,
  },
  appName: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  form: {
    gap: 12,
  },
  welcomeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    marginBottom: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  primaryBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  linkText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  link: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 32,
    lineHeight: 16,
  },
});
