import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL, type PurchasesPackage } from "react-native-purchases";
import { getPremiumStatus, type PremiumStatus } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";
import { aiRequest } from "@/lib/ai";
import config from "@/lib/premium-config.json";

const testMode = Platform.OS === "web" || Constants.appOwnership === "expo";
let initialized = false;
let identityQueue: Promise<unknown> = Promise.resolve();

interface PremiumContextValue {
  status: PremiumStatus | null;
  monthlyPackage: PurchasesPackage | null;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
  message: string | null;
  testMode: boolean;
  refresh: (showFeedback?: boolean) => Promise<PremiumStatus | null>;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
}
const Context = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const actionInFlight = useRef(false);
  const currentUser = useRef(user?.uid);
  currentUser.current = user?.uid;

  const refresh = useCallback(async (showFeedback = false) => {
    const identity = user?.uid;
    try {
      const value = await aiRequest(options => getPremiumStatus(options));
      if (currentUser.current === identity) {
        setStatus(value);
        if (showFeedback) {
          setError(null);
          setMessage(value.premium ? "Premium access refreshed and verified." : "Access checked. No active Premium subscription was found.");
        }
      }
      return value;
    } catch (failure) {
      if (currentUser.current === identity) setError(failure instanceof Error ? failure.message : "Could not verify Premium.");
      return null;
    }
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setMonthlyPackage(null);
    setLoading(false);
    setError(null);
    setMessage(null);
    void refresh();
    if (!user?.uid) return;
    if (!testMode && Platform.OS !== "android") {
      setError("Premium store purchases are currently configured for Android only.");
      return;
    }
    const uid = user.uid;
    setLoading(true);
    identityQueue = identityQueue.catch(() => {}).then(async () => {
      if (cancelled) return;
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      if (!initialized) {
        Purchases.configure({ apiKey: testMode ? config.testKey : config.androidKey, appUserID: uid });
        initialized = true;
      } else {
        await Purchases.logIn(uid);
      }
      const offerings = await Purchases.getOfferings();
      if (!cancelled) {
        setMonthlyPackage(offerings.current?.monthly ?? null);
        if (!offerings.current?.monthly) setError("The monthly subscription is not available from this store yet.");
      }
    }).catch(() => {
      if (!cancelled) setError("Purchases are unavailable. Please try again later.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid, refresh]);

  const verifyAfterPurchase = useCallback(async (restoring: boolean) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const access = await refresh();
      if (access?.premium) return;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(restoring
      ? "No active Premium subscription was found. Check the store account and Scam Alert account you originally used."
      : "The store received your purchase, but server verification is pending. Use Restore purchases or refresh access shortly. Do not buy again.");
  }, [refresh]);

  const action = useCallback(async (restore: boolean) => {
    if (!user?.uid) { setError("Sign in before purchasing or restoring Premium."); return; }
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setPurchasing(true);
    setError(null);
    setMessage(null);
    try {
      await identityQueue;
      if (!initialized || await Purchases.getAppUserID() !== user.uid) throw new Error("Your purchase account is not ready. Try again.");
      if (restore) {
        await Purchases.restorePurchases();
      } else {
        if (!monthlyPackage) throw new Error("The monthly subscription is not available from this store.");
        if (!testMode) {
          const live = await refresh();
          if (!live?.generationAvailable) throw new Error("Premium generation is not available yet. No purchase was started.");
          if (live.premium) { setMessage("Premium is already active. No new purchase was started."); return; }
        }
        await Purchases.purchasePackage(monthlyPackage);
      }
      if (currentUser.current !== user.uid) throw new Error("Your account changed during the store transaction. Sign in to the original account and restore purchases.");
      await verifyAfterPurchase(restore);
      setMessage(restore ? "Purchases restored and Premium verified." : "Purchase verified. Premium is active.");
    } catch (failure) {
      if (!(failure && typeof failure === "object" && "userCancelled" in failure && failure.userCancelled)) {
        setError(failure instanceof Error ? failure.message : "The purchase could not be completed.");
      }
    } finally { actionInFlight.current = false; setPurchasing(false); }
  }, [user?.uid, purchasing, monthlyPackage, status?.generationAvailable, verifyAfterPurchase]);

  return <Context.Provider value={{ status, monthlyPackage, loading, purchasing, error, message, testMode,
    refresh, purchase: () => action(false), restore: () => action(true) }}>{children}</Context.Provider>;
}

export function usePremium() {
  const value = useContext(Context);
  if (!value) throw new Error("PremiumProvider is missing");
  return value;
}
