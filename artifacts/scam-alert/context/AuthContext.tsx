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
  type User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";

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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [fetchProfile]);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user.uid);
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
    await updateDoc(doc(db, "users", user.uid), data as Record<string, unknown>);
    setProfile((prev) => (prev ? { ...prev, ...data } : prev));
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
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
