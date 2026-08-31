import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const rawFirebaseConfig = process.env.EXPO_PUBLIC_FIREBASE_CONFIG?.trim();

const configFromBundle = (() => {
  if (!rawFirebaseConfig) return {};

  try {
    return JSON.parse(rawFirebaseConfig) as Record<string, string>;
  } catch {
    const getValue = (key: string) =>
      rawFirebaseConfig.match(
        new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`),
      )?.[1];

    return {
      apiKey: getValue("apiKey"),
      authDomain: getValue("authDomain"),
      projectId: getValue("projectId"),
      storageBucket: getValue("storageBucket"),
      messagingSenderId: getValue("messagingSenderId"),
      appId: getValue("appId"),
    };
  }
})();

const firebaseConfig = {
  apiKey:
    configFromBundle.apiKey ??
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
    "placeholder-key",
  authDomain:
    configFromBundle.authDomain ??
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "placeholder.firebaseapp.com",
  projectId:
    configFromBundle.projectId ??
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??
    "placeholder-project",
  storageBucket:
    configFromBundle.storageBucket ??
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "",
  messagingSenderId:
    configFromBundle.messagingSenderId ??
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    "",
  appId:
    configFromBundle.appId ??
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
    "",
};

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== "placeholder-key" &&
  firebaseConfig.projectId !== "placeholder-project"
);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch {
  app = getApps()[0] ?? initializeApp(firebaseConfig, "fallback");
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { auth, db, storage };
export default app;
