import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithCredential,
  updateProfile as firebaseUpdateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import Constants from "expo-constants";
import { ResponseType } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import {
  registerForPushNotifications,
} from "@/lib/notifications";

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  profilePhoto: string | null;
  niche: string;
  bio: string;
  followers: string[];
  following: string[];
  isAdmin: boolean;
  createdAt: number;
  expoPushToken?: string;
}

export const CATEGORIES = [
  { id: "scam-alert", label: "Scam Alert", icon: "alert-triangle" },
  { id: "news", label: "News", icon: "rss" },
  { id: "motivation", label: "Motivation", icon: "star" },
  { id: "health", label: "Health", icon: "heart" },
  { id: "finance", label: "Finance", icon: "dollar-sign" },
  { id: "crime-awareness", label: "Crime Awareness", icon: "shield" },
  { id: "technology", label: "Technology", icon: "cpu" },
  { id: "education", label: "Education", icon: "book" },
  { id: "entertainment", label: "Entertainment", icon: "tv" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const NICHES = [
  "Cybersecurity",
  "Finance",
  "Health & Wellness",
  "Technology",
  "News & Journalism",
  "Education",
  "Law & Crime",
  "General Awareness",
];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  firebaseConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    username: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

WebBrowser.maybeCompleteAuthSession();

function createAuthError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const googleConfig = Constants.expoConfig?.extra as
    | {
        googleAndroidClientId?: string;
        googleWebClientId?: string;
      }
    | undefined;
  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    googleConfig?.googleAndroidClientId;
  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    googleConfig?.googleWebClientId;
  const activeGoogleClientId =
    Platform.OS === "android"
      ? googleAndroidClientId
      : googleWebClientId;
  const [nativeGoogleRequest, , promptNativeGoogle] = Google.useAuthRequest({
    clientId:
      activeGoogleClientId ??
      "google-native-auth-not-configured.apps.googleusercontent.com",
    androidClientId: googleAndroidClientId,
    webClientId: googleWebClientId,
    responseType: ResponseType.IdToken,
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
  });

  const savePushToken = useCallback(async (uid: string) => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await updateDoc(doc(db, "users", uid), { expoPushToken: token });
      }
    } catch {
      // Notifications are optional
    }
  }, []);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      setUser(firebaseUser);
      setProfileError(null);

      if (firebaseUser) {
        setLoading(true);
        profileUnsub = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          () => {
            setProfile(null);
            setProfileError(
              "Your profile could not be loaded. Please check your connection and try again.",
            );
            setLoading(false);
          },
        );
        savePushToken(firebaseUser.uid);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, [savePushToken]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const ensureGoogleProfile = async (firebaseUser: User) => {
    const profileRef = doc(db, "users", firebaseUser.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? "",
        username:
          firebaseUser.displayName?.trim() ||
          firebaseUser.email?.split("@")[0] ||
          "New user",
        profilePhoto: firebaseUser.photoURL ?? null,
        niche: "",
        bio: "",
        followers: [],
        following: [],
        isAdmin: false,
        createdAt: Date.now(),
      };

      await setDoc(profileRef, {
        ...newProfile,
        createdAt: serverTimestamp(),
      });
      setProfile(newProfile);
      return true;
    }

    return false;
  };

  const signInWithGoogle = async () => {
    if (Platform.OS === "web") {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      return ensureGoogleProfile(credential.user);
    }

    if (!googleAndroidClientId || !nativeGoogleRequest) {
      throw createAuthError(
        "auth/google-native-not-configured",
        "This Android build is missing its Google OAuth client configuration.",
      );
    }

    const result = await promptNativeGoogle();
    if (result.type === "cancel" || result.type === "dismiss") {
      throw createAuthError("auth/popup-closed-by-user", "Google sign-in was cancelled.");
    }
    if (result.type !== "success") {
      throw createAuthError("auth/google-sign-in-failed", "Google sign-in did not complete.");
    }

    const idToken = result.params.id_token ?? result.authentication?.idToken;
    const accessToken =
      result.params.access_token ?? result.authentication?.accessToken;
    if (!idToken && !accessToken) {
      throw createAuthError(
        "auth/missing-google-token",
        "Google did not return a usable sign-in token.",
      );
    }

    const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
    const credential = await signInWithCredential(auth, googleCredential);
    return ensureGoogleProfile(credential.user);
  };

  const signup = async (
    email: string,
    password: string,
    username: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await firebaseUpdateProfile(cred.user, { displayName: username });
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      username,
      profilePhoto: null,
      niche: "",
      bio: "",
      followers: [],
      following: [],
      isAdmin: false,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, "users", cred.user.uid), {
      ...newProfile,
      createdAt: serverTimestamp(),
    });
    setProfile(newProfile);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), data as Record<string, unknown>, { merge: true });
    setProfile((prev) => (prev ? { ...prev, ...data } : prev));
  };

  const refreshProfile = async () => {
    // Profile is now kept in sync via onSnapshot — no manual refresh needed
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        firebaseConfigured: isFirebaseConfigured,
        login,
        signInWithGoogle,
        signup,
        logout,
        updateUserProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
