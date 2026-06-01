import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { user, profile, loading } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  // Only force onboarding when profile loaded successfully but has no niche.
  // If profile is null (Firestore failed after retries), skip onboarding and
  // go straight to tabs — the user can set their niche later in settings.
  if (profile !== null && !profile.niche) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)/" />;
}
