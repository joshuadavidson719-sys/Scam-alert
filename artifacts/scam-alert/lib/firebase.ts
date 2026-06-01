import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { Platform, LogBox } from "react-native";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// Silence Firebase Firestore permission-denied overlay in Expo Go dev mode.
// These are handled gracefully via error callbacks — no need to show the overlay.
LogBox.ignoreLogs([
  "Missing or insufficient permissions",
  "@firebase/firestore",
  "permission-denied",
  "AsyncStorage has been extracted",
  "shadow* style props are deprecated",
  "textShadow* style props are deprecated",
  "setLayoutAnimationEnabledExperimental",
  "[expo-av]",
]);

export const isFirebaseConfigured = !!(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
);

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "placeholder-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "placeholder.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "placeholder-project",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const isNewApp = getApps().length === 0;
app = isNewApp ? initializeApp(firebaseConfig) : getApps()[0];

// Set up persistent auth for native (stays logged in between sessions)
if (Platform.OS !== "web" && isNewApp) {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

db = getFirestore(app);
storage = getStorage(app);

export { auth, db, storage };
export default app;
