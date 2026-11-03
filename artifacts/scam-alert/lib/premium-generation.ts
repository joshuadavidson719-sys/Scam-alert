import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  generatePremiumImage, generatePremiumAnimation, recoverPremiumGeneration,
  type PremiumGenerationInput, type PremiumGenerationResult,
} from "@workspace/api-client-react";
import { auth } from "./firebase";
import { AiRequestError, aiRequest } from "./ai";

function storageKey() {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to use Premium generation.");
  return `premium-last-generation:${user.uid}`;
}
export async function recoverLastGeneration(): Promise<PremiumGenerationResult> {
  const last = await AsyncStorage.getItem(storageKey());
  if (!last) throw new Error("You have no saved generation to recover on this device.");
  const record = JSON.parse(last) as { id: string };
  const result = await aiRequest(options => recoverPremiumGeneration(record.id, options));
  await AsyncStorage.setItem(storageKey(), JSON.stringify({ id: record.id, pending: false }));
  return result;
}
export async function generatePaid(
  mode: "image" | "animation",
  input: Omit<PremiumGenerationInput, "requestId">,
): Promise<PremiumGenerationResult> {
  const key = storageKey();
  const last = await AsyncStorage.getItem(key);
  if (last && (JSON.parse(last) as { pending?: boolean }).pending) {
    try {
      // Never start another paid request while an interrupted request may be running.
      return await recoverLastGeneration();
    } catch (failure) {
      if (!(failure instanceof AiRequestError) || ![404, 410].includes(failure.status ?? 0)) throw failure;
    }
  }
  const requestId = Crypto.randomUUID();
  await AsyncStorage.setItem(key, JSON.stringify({ id: requestId, pending: true }));
  const result = await aiRequest(options => (
    mode === "image"
      ? generatePremiumImage({ ...input, requestId }, options)
      : generatePremiumAnimation({ ...input, requestId }, options)
  ), 300_000);
  await AsyncStorage.setItem(key, JSON.stringify({ id: requestId, pending: false }));
  return result;
}
