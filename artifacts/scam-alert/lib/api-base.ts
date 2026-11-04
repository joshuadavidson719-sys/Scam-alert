import Constants from "expo-constants";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { auth } from "./firebase";

export function getApiOrigin() {
  const extra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const developmentOrigin = Constants.expoConfig?.extra?.developmentApiBaseUrl as string | undefined;
  const origin = process.env.EXPO_PUBLIC_API_BASE_URL
    || (__DEV__ ? (developmentOrigin || (domain ? `https://${domain}` : extra)) : extra);
  if (!origin) throw new Error("The app server address is missing from this build.");
  const url = new URL(origin);
  if (url.protocol !== "https:" || (!__DEV__ && /\.replit\.dev$/.test(url.hostname))) {
    throw new Error("The app server address must be a published HTTPS service.");
  }
  return url.origin;
}
export function configureApi() {
  setBaseUrl(getApiOrigin());
  setAuthTokenGetter(() => auth.currentUser?.getIdToken() ?? null);
}
export function resolveProfilePhotoUri(uri: string | null | undefined) {
  if (!uri?.startsWith("/api/profile-photos/")) return uri;
  try { return `${getApiOrigin()}${uri}`; } catch { return null; }
}
