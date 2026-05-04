import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, NICHES } from "@/context/AuthContext";

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateUserProfile } = useAuth();
  const [selectedNiche, setSelectedNiche] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedNiche) return;
    setLoading(true);
    try {
      await updateUserProfile({ niche: selectedNiche });
      router.replace("/(tabs)/" as never);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace("/(tabs)/" as never);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Choose Your Niche</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select the area you're most interested in. This helps personalize your feed.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {NICHES.map((niche) => (
          <TouchableOpacity
            key={niche}
            style={[
              styles.nicheCard,
              {
                backgroundColor:
                  selectedNiche === niche ? colors.primary : colors.card,
                borderColor:
                  selectedNiche === niche ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedNiche(niche)}
            activeOpacity={0.8}
          >
            {selectedNiche === niche && (
              <View style={styles.checkIcon}>
                <Text style={{ fontSize: 14, color: "#fff", fontWeight: "bold" }}>✓</Text>
              </View>
            )}
            <Text
              style={[
                styles.nicheName,
                { color: selectedNiche === niche ? "#fff" : colors.text },
              ]}
            >
              {niche}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.continueBtn,
            {
              backgroundColor: selectedNiche ? colors.primary : colors.muted,
            },
          ]}
          onPress={handleContinue}
          disabled={!selectedNiche || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueBtnText}>Get Started</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 20,
  },
  nicheCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    position: "relative",
  },
  checkIcon: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  nicheName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  continueBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  continueBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
