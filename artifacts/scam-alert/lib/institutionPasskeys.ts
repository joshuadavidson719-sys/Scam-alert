import {
  startInstitutionPasskeyRegistration, finishInstitutionPasskeyRegistration,
  startInstitutionPasskeyApproval, finishInstitutionPasskeyApproval,
  type InstitutionCheckoutIntent,
} from "@workspace/api-client-react";
import { configureApi } from "./api-base";

export function supportsInstitutionPasskeys() {
  return typeof window !== "undefined" && window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" && !!navigator.credentials;
}
function supported() {
  if (!supportsInstitutionPasskeys()) throw new Error("Passkeys require a supported browser on a secure website. Try current Chrome, Safari or Edge.");
  configureApi();
}
async function approve(purpose: "checkout" | "enroll", checkout?: InstitutionCheckoutIntent) {
  supported();
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const options = await startInstitutionPasskeyApproval({ purpose, ...(checkout ? { checkout } : {}) });
  const credential = await startAuthentication({
    optionsJSON: options.options as unknown as Parameters<typeof startAuthentication>[0]["optionsJSON"],
  });
  const result = await finishInstitutionPasskeyApproval({
    challengeId: options.challengeId, credential: credential as unknown as Record<string, unknown>,
  });
  if (result.purpose !== purpose) throw new Error("Passkey approval does not match the requested action.");
  return result.approvalToken;
}
export async function registerInstitutionPasskey(hasExistingKeys: boolean) {
  supported();
  const managementApproval = hasExistingKeys ? await approve("enroll") : undefined;
  const { startRegistration } = await import("@simplewebauthn/browser");
  const options = await startInstitutionPasskeyRegistration(managementApproval ? { managementApproval } : {});
  const credential = await startRegistration({
    optionsJSON: options.options as unknown as Parameters<typeof startRegistration>[0]["optionsJSON"],
  });
  return finishInstitutionPasskeyRegistration({
    challengeId: options.challengeId, credential: credential as unknown as Record<string, unknown>,
  });
}
export const approveInstitutionCheckout = (checkout: InstitutionCheckoutIntent) => approve("checkout", checkout);

export function passkeyErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "data" in error && error.data &&
      typeof error.data === "object" && "error" in error.data && typeof error.data.error === "string") {
    return error.data.error;
  }
  if (error instanceof Error && ["NotAllowedError", "AbortError", "WebAuthnError"].includes(error.name)) {
    return "Passkey approval was cancelled or could not be completed. Nothing was purchased. Please try again.";
  }
  return "Passkey verification could not be completed. Checkout remains locked; please try again.";
}
