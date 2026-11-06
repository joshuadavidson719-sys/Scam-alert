import { randomBytes } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { WebAuthnCredential } from "@simplewebauthn/server";
import { AiServiceError } from "../groq";
import { passkeyDatabase } from "./admin";
import {
  accountId, hash, MAX_PASSKEYS, requireBoundRecord, CHALLENGE_LIFETIME_MS, APPROVAL_LIFETIME_MS,
  type PasskeyContext,
} from "./policy";

export type StoredKey = {
  id: string; publicKey: string; counter: number; transports: NonNullable<WebAuthnCredential["transports"]>;
  createdAt: number; lastUsedAt: number; deviceType: string; backedUp: boolean;
};
export type Account = { version: number; keys: StoredKey[] };
export type Challenge = PasskeyContext & {
  kind: "register" | "authenticate"; challenge: string; version: number;
  purpose: "checkout" | "enroll"; binding: string; expiresAt: number;
};
type Approval = PasskeyContext & {
  purpose: "checkout" | "enroll"; binding: string; version: number; credentialId: string; expiresAt: number;
};
const empty = (): Account => ({ version: 0, keys: [] });
export class PasskeyStore {
  constructor(private readonly db: Firestore = passkeyDatabase()) {}
  private account(context: PasskeyContext) {
    return this.db.collection("_institutionPasskeyAccounts").doc(accountId(context));
  }
  private challenge(id: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) throw new AiServiceError(400, "Invalid passkey challenge.");
    return this.db.collection("_institutionPasskeyChallenges").doc(hash(id));
  }
  private approval(id: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) throw new AiServiceError(403, "Passkey approval is required before checkout.");
    return this.db.collection("_institutionPasskeyApprovals").doc(hash(id));
  }
  async readAccount(context: PasskeyContext): Promise<Account> {
    const doc = await this.account(context).get();
    return doc.exists ? doc.data() as Account : empty();
  }
  async limitAttempt(context: PasskeyContext) {
    // Shared storage, not just an in-memory limiter that resets on each
    // Vercel instance. All websites share the same per-account attempt budget.
    const ref = this.db.collection("_institutionPasskeyLimits").doc(hash(context.uid));
    await this.db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      const current = doc.data() as { start: number; count: number } | undefined;
      const now = Date.now();
      const sameWindow = !!current && current.start + 15 * 60_000 > now;
      if (sameWindow && current!.count >= 50) throw new AiServiceError(429, "Too many passkey attempts. Wait 15 minutes before trying again.");
      const start = sameWindow ? current!.start : now;
      tx.set(ref, { start, count: sameWindow ? current!.count + 1 : 1, deleteAfter: Timestamp.fromMillis(start + 15 * 60_000) });
    });
  }
  async saveChallenge(record: Omit<Challenge, "expiresAt">) {
    const id = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + CHALLENGE_LIFETIME_MS;
    await this.challenge(id).create({ ...record, expiresAt, deleteAfter: Timestamp.fromMillis(expiresAt) });
    return id;
  }
  // Delete inside a shared Firestore transaction before verification. A failed
  // response burns its challenge; replay/races cannot verify it a second time.
  async takeChallenge(id: string, context: PasskeyContext, kind: Challenge["kind"]): Promise<Challenge> {
    const ref = this.challenge(id);
    return this.db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      const data = doc.data() as Challenge | undefined;
      requireBoundRecord(data, context);
      if (data!.kind !== kind) throw new AiServiceError(403, "Incorrect passkey challenge.");
      tx.delete(ref);
      return data!;
    });
  }
  async addKey(context: PasskeyContext, challenge: Challenge, key: StoredKey) {
    const ref = this.account(context);
    const unique = this.db.collection("_institutionPasskeyCredentialOwners").doc(hash(`${context.rpId}\0${key.id}`));
    return this.db.runTransaction(async tx => {
      const [doc, owner] = await Promise.all([tx.get(ref), tx.get(unique)]);
      const account = doc.exists ? doc.data() as Account : empty();
      if (account.version !== challenge.version) throw new AiServiceError(409, "Passkey settings changed. Verify an existing passkey and try again.");
      if (owner.exists || account.keys.some(candidate => candidate.id === key.id)) throw new AiServiceError(409, "This passkey is already registered.");
      if (account.keys.length >= MAX_PASSKEYS) throw new AiServiceError(409, "The maximum number of passkeys has been reached.");
      const updated = { version: account.version + 1, keys: [...account.keys, key] };
      tx.set(ref, updated);
      tx.create(unique, { account: accountId(context) });
      return updated;
    });
  }
  async approve(context: PasskeyContext, challenge: Challenge, previous: StoredKey, newCounter: number) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + APPROVAL_LIFETIME_MS;
    await this.db.runTransaction(async tx => {
      const ref = this.account(context);
      const doc = await tx.get(ref);
      const account = doc.data() as Account | undefined;
      const current = account?.keys.find(key => key.id === previous.id);
      if (!account || account.version !== challenge.version || !current ||
          current.publicKey !== previous.publicKey || current.counter !== previous.counter) {
        throw new AiServiceError(409, "Passkey settings changed. Please approve again.");
      }
      tx.update(ref, { keys: account.keys.map(key => key.id === previous.id ? {
        ...key, counter: newCounter, lastUsedAt: Date.now(),
      } : key) });
      tx.create(this.approval(token), {
        ...context, purpose: challenge.purpose, binding: challenge.binding, version: account.version,
        credentialId: previous.id, expiresAt, deleteAfter: Timestamp.fromMillis(expiresAt),
      } satisfies Approval & { deleteAfter: Timestamp });
    });
    return token;
  }
  async consumeApproval(token: string, context: PasskeyContext, purpose: Approval["purpose"], binding: string) {
    const ref = this.approval(token);
    await this.db.runTransaction(async tx => {
      const [doc, accountDoc] = await Promise.all([tx.get(ref), tx.get(this.account(context))]);
      const approval = doc.data() as Approval | undefined;
      const account = accountDoc.data() as Account | undefined;
      requireBoundRecord(approval, context);
      if (!account || approval!.purpose !== purpose || approval!.binding !== binding ||
          account.version !== approval!.version || !account.keys.some(key => key.id === approval!.credentialId)) {
        throw new AiServiceError(403, "Passkey approval does not match this action. Please approve again.");
      }
      tx.delete(ref);
    });
  }
}
