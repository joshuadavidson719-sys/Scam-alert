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
  signOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  GithubAuthProvider,
  signInWithCredential,
  type User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import {
  registerForPushNotifications,
} from "@/lib/notifications";

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  profilePhoto: string | null;
  bannerPhoto?: string | null;
  niche: string;
  bio: string;
  followers: string[];
  following: string[];
  isAdmin: boolean;
  isBanned: boolean;
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
  firebaseConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithGitHub: (accessToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    // Sequential retry loop — keeps the promise alive so callers can await the
    // full result before deciding what to render (no premature setLoading(false)).
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise<void>((res) => setTimeout(res, 1000 * attempt));
      }
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        return; // success
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? "";
        const isLast = attempt === maxAttempts - 1;
        if (code !== "permission-denied" || isLast) {
          setProfile(null);
          return;
        }
        // permission-denied — auth token may not be ready yet, retry
      }
    }
  }, []);

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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
        savePushToken(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [fetchProfile, savePushToken]);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && (snap.data() as UserProfile).isBanned) {
        await signOut(auth);
        throw new Error("Your account has been suspended. Please contact support.");
      }
      await fetchProfile(cred.user.uid);
    } catch (firestoreErr: unknown) {
      const code = (firestoreErr as { code?: string })?.code ?? "";
      const msg = (firestoreErr as Error)?.message ?? "";
      // If Firestore rules haven't been configured yet, still let the user in
      // but surface a clear message for suspension errors
      if (msg.includes("suspended")) {
        throw firestoreErr;
      }
      if (code !== "permission-denied" && !msg.includes("permission")) {
        throw firestoreErr;
      }
      // permission-denied on profile read: auth succeeded, profile will retry via onAuthStateChanged
    }
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
      isBanned: false,
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
    // If niche is changing, update live counts in Firestore
    if (data.niche !== undefined && data.niche !== profile?.niche) {
      const oldNiche = profile?.niche;
      const newNiche = data.niche;
      try {
        if (oldNiche) {
          await setDoc(doc(db, "nicheCounts", oldNiche), { count: increment(-1) }, { merge: true });
        }
        if (newNiche) {
          await setDoc(doc(db, "nicheCounts", newNiche), { count: increment(1) }, { merge: true });
        }
      } catch {
        // non-fatal — counts are best-effort
      }
    }
    await updateDoc(doc(db, "users", user.uid), data as Record<string, unknown>);
    setProfile((prev) => (prev ? { ...prev, ...data } : prev));
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const signInWithGitHub = async (accessToken: string) => {
    const credential = GithubAuthProvider.credential(accessToken);
    const cred = await signInWithCredential(auth, credential);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) {
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email ?? "",
        username:
          cred.user.displayName ?? `user_${cred.user.uid.slice(0, 6)}`,
        profilePhoto: cred.user.photoURL ?? null,
        niche: "",
        bio: "",
        followers: [],
        following: [],
        isAdmin: false,
        isBanned: false,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "users", cred.user.uid), {
        ...newProfile,
        createdAt: serverTimestamp(),
      });
      setProfile(newProfile);
    } else {
      setProfile(snap.data() as UserProfile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        firebaseConfigured: isFirebaseConfigured,
        login,
        signup,
        logout,
        updateUserProfile,
        refreshProfile,
        signInWithGitHub,
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
