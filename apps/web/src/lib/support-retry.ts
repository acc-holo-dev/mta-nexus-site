/**
 * Recover an ambiguous support mutation after a same-tab reload. Persist only
 * an opaque key, the SHA-256 of the normalized payload, and non-sensitive
 * status/timing metadata: never persist subject or message text.
 */
export type SupportRetryStatus = "open" | "resolved" | "closed";
export type SupportRetryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SupportRetryAttempt = Readonly<{
  key: string;
  payload: string;
  recovered: boolean;
}>;

type StoredAttempt = {
  version: 1;
  key: string;
  digest: string;
  observedStatus: SupportRetryStatus | null;
  expiresAt: number;
};

type RetryOptions = {
  storage?: SupportRetryStorage | null;
  now?: number;
  newKey?: () => string;
};

const PREFIX = "nexus:support:retry:v1:";
const TTL_MS = 24 * 60 * 60 * 1000;
const UUID_V4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const inMemory = new Map<string, string>();
const fallbackStore: SupportRetryStorage = {
  getItem: (key) => inMemory.get(key) ?? null,
  setItem: (key, value) => { inMemory.set(key, value); },
  removeItem: (key) => { inMemory.delete(key); },
};

function getStorage(options: RetryOptions): SupportRetryStorage {
  if (options.storage !== undefined) return options.storage ?? fallbackStore;
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : fallbackStore;
  } catch {
    return fallbackStore;
  }
}

function slotFor(scope: string): string {
  return PREFIX + scope;
}

function isStatus(value: unknown): value is SupportRetryStatus {
  return value === "open" || value === "resolved" || value === "closed";
}

function readAttempt(store: SupportRetryStorage, slot: string, now: number): StoredAttempt | null {
  try {
    const raw = store.getItem(slot);
    if (!raw || raw.length > 512) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const x = value as Partial<StoredAttempt>;
    if (
      x.version !== 1 ||
      typeof x.key !== "string" || !UUID_V4.test(x.key) ||
      typeof x.digest !== "string" || !DIGEST.test(x.digest) ||
      (x.observedStatus !== null && !isStatus(x.observedStatus)) ||
      typeof x.expiresAt !== "number" || !Number.isSafeInteger(x.expiresAt) ||
      x.expiresAt <= now || x.expiresAt > now + TTL_MS
    ) return null;
    return x as StoredAttempt;
  } catch {
    return null;
  }
}

function writeAttempt(store: SupportRetryStorage, slot: string, value: StoredAttempt): void {
  try {
    store.setItem(slot, JSON.stringify(value));
  } catch {
    // Browsers may disable sessionStorage; the mutation still works, but
    // recoverability across reload is unavailable in that environment.
  }
}

async function digest(payload: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function reserve(
  scope: string,
  payloadAt: (status: SupportRetryStatus | null) => string,
  observedStatus: SupportRetryStatus | null,
  options: RetryOptions = {},
): Promise<SupportRetryAttempt> {
  const store = getStorage(options);
  const slot = slotFor(scope);
  const now = options.now ?? Date.now();
  const old = readAttempt(store, slot, now);
  if (old) {
    const oldPayload = payloadAt(old.observedStatus);
    if (await digest(oldPayload) === old.digest) {
      return { key: old.key, payload: oldPayload, recovered: true };
    }
  }
  const payload = payloadAt(observedStatus);
  const key = (options.newKey ?? (() => crypto.randomUUID()))();
  if (!UUID_V4.test(key)) throw new Error("Invalid support retry key generator");
  writeAttempt(store, slot, {
    version: 1,
    key,
    digest: await digest(payload),
    observedStatus,
    expiresAt: now + TTL_MS,
  });
  return { key, payload, recovered: false };
}

export function reserveSupportCaseRetry(
  normalizedPayload: string,
  options?: RetryOptions,
): Promise<SupportRetryAttempt> {
  return reserve("case", () => normalizedPayload, null, options);
}

export function reserveSupportReplyRetry(
  caseId: string,
  normalizedMessage: string,
  currentStatus: SupportRetryStatus,
  options?: RetryOptions,
): Promise<SupportRetryAttempt> {
  if (!/^sup_[a-f0-9]{24}$/u.test(caseId)) throw new Error("Invalid support case id");
  return reserve(
    "reply:" + caseId,
    (status) => JSON.stringify({ message: normalizedMessage, expectedStatus: status }),
    currentStatus,
    options,
  );
}

/** Do not remove a newer retry slot if an older mutation completes late. */
export function clearSupportRetry(
  scope: string,
  key: string,
  options: RetryOptions = {},
): void {
  const store = getStorage(options);
  const slot = slotFor(scope);
  const current = readAttempt(store, slot, options.now ?? Date.now());
  if (current?.key !== key) return;
  try { store.removeItem(slot); } catch { /* Non-persistent storage is optional. */ }
}
