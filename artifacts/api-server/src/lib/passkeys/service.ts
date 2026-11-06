import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { AiServiceError } from "../groq";
import {
  actionBinding, APPROVAL_LIFETIME_MS, hash, MAX_PASSKEYS, publicUserId, RECOVERY_MESSAGE,
  type CheckoutIntent, type PasskeyContext,
} from "./policy";
import { PasskeyStore } from "./store";

export class InstitutionPasskeys {
  constructor(private readonly context: PasskeyContext, private readonly store = new PasskeyStore()) {}
  async status() {
    const account = await this.store.readAccount(this.context);
    return { count: account.keys.length, rpId: this.context.rpId, maxKeys: MAX_PASSKEYS, recoveryMessage: RECOVERY_MESSAGE };
  }
  async registrationOptions(managementApproval?: string) {
    let account = await this.store.readAccount(this.context);
    if (account.keys.length >= MAX_PASSKEYS) throw new AiServiceError(409, "The maximum number of passkeys has been reached.");
    if (account.keys.length) {
      if (!managementApproval) throw new AiServiceError(403, "Approve adding a backup with an existing passkey first.");
      await this.store.consumeApproval(managementApproval, this.context, "enroll", actionBinding(this.context, "enroll"));
      account = await this.store.readAccount(this.context);
    }
    const options = await generateRegistrationOptions({
      rpName: "Scam Alert institutional checkout", rpID: this.context.rpId,
      userID: publicUserId(this.context), userName: `Scam Alert ${hash(this.context.uid).slice(0, 8)}`,
      attestationType: "none", timeout: 120_000, supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: account.keys.map(key => ({ id: key.id, transports: key.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      preferredAuthenticatorType: "localDevice",
    });
    const challengeId = await this.store.saveChallenge({
      ...this.context, kind: "register", challenge: options.challenge, version: account.version,
      purpose: "enroll", binding: actionBinding(this.context, "enroll"),
    });
    return { challengeId, options };
  }
  async register(challengeId: string, response: RegistrationResponseJSON) {
    const challenge = await this.store.takeChallenge(challengeId, this.context, "register");
    let verified;
    try {
      verified = await verifyRegistrationResponse({
        response, expectedChallenge: challenge.challenge, expectedOrigin: this.context.origin,
        expectedRPID: this.context.rpId, requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch { throw new AiServiceError(403, "Passkey registration could not be verified. Please try again."); }
    if (!verified.verified || !verified.registrationInfo) throw new AiServiceError(403, "Passkey registration was not verified.");
    const info = verified.registrationInfo;
    await this.store.addKey(this.context, challenge, {
      id: info.credential.id, publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
      counter: info.credential.counter, transports: info.credential.transports ?? [],
      createdAt: Date.now(), lastUsedAt: 0,
      deviceType: info.credentialDeviceType, backedUp: info.credentialBackedUp,
    });
    return this.status();
  }
  async authenticationOptions(purpose: "checkout" | "enroll", intent?: CheckoutIntent) {
    const account = await this.store.readAccount(this.context);
    if (!account.keys.length) throw new AiServiceError(403, "Register a passkey before approving institutional checkout.");
    const binding = actionBinding(this.context, purpose, intent);
    const options = await generateAuthenticationOptions({
      rpID: this.context.rpId, timeout: 120_000, userVerification: "required",
      allowCredentials: account.keys.map(key => ({ id: key.id, transports: key.transports })),
    });
    const challengeId = await this.store.saveChallenge({
      ...this.context, kind: "authenticate", challenge: options.challenge, version: account.version, purpose, binding,
    });
    return { challengeId, options };
  }
  async authenticate(challengeId: string, response: AuthenticationResponseJSON) {
    const challenge = await this.store.takeChallenge(challengeId, this.context, "authenticate");
    const account = await this.store.readAccount(this.context);
    const key = account.keys.find(candidate => candidate.id === response.id);
    if (!key || account.version !== challenge.version) throw new AiServiceError(403, "This passkey is not registered to this account and website.");
    if (response.response?.userHandle && response.response.userHandle !== Buffer.from(publicUserId(this.context)).toString("base64url")) {
      throw new AiServiceError(403, "This passkey belongs to another account.");
    }
    let verified;
    try {
      verified = await verifyAuthenticationResponse({
        response, expectedChallenge: challenge.challenge, expectedOrigin: this.context.origin,
        expectedRPID: this.context.rpId, requireUserVerification: true,
        credential: {
          id: key.id, publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
          counter: key.counter, transports: key.transports,
        },
      });
    } catch { throw new AiServiceError(403, "Passkey approval could not be verified. Please try again."); }
    if (!verified.verified) throw new AiServiceError(403, "Passkey approval was not verified.");
    const approvalToken = await this.store.approve(this.context, challenge, key, verified.authenticationInfo.newCounter);
    return { approvalToken, expiresInSeconds: APPROVAL_LIFETIME_MS / 1000, purpose: challenge.purpose };
  }
  async approveCheckout(token: string, intent: CheckoutIntent) {
    await this.store.consumeApproval(token, this.context, "checkout", actionBinding(this.context, "checkout", intent));
  }
}
