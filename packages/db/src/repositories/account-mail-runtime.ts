import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parseAccountMailAppUrl } from "./account-mail-app-url";
import { AccountMailCipher } from "./account-mail-crypto";
import { AccountMailDispatcher } from "./account-mail-dispatcher";
import { AccountMailSmtpTransport } from "./account-mail-smtp";

export type AccountMailRuntimeConfig = Readonly<{
  activeKeyId: string;
  keys: Readonly<Record<string, Uint8Array>>;
  appUrl: string;
  allowLocalHttp?: boolean;
  previousKeyId?: string;
  smtpHost: string;
  smtpMode: "implicit_tls" | "starttls";
  smtpPort: number;
  smtpServername: string;
  smtpFrom: string;
  smtpEnvelopeFrom?: string;
  smtpAuthMode: "auto" | "plain" | "login";
  smtpUsername?: string;
  smtpPassword?: string;
  smtpCa?: string;
  smtpTimeoutMs: number;
  batchSize: number;
  pollIntervalMs: number;
}>;

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing account mail configuration: ${key}`);
  return value;
}

function secretSource(
  env: Record<string, string | undefined>,
  valueKey: string,
  fileKey: string,
  label: string,
  options: { required?: boolean; maxBytes?: number } = {},
): string | undefined {
  const direct = env[valueKey] || undefined;
  const file = env[fileKey] || undefined;
  if (direct && file) {
    throw new Error(`${label} must use either ${valueKey} or ${fileKey}, not both`);
  }
  if (!direct && !file) {
    if (options.required) {
      throw new Error(`Missing account mail configuration: ${valueKey} or ${fileKey}`);
    }
    return undefined;
  }
  if (direct) return direct;
  if (!file || !isAbsolute(file) || file.length > 4096) {
    throw new Error(`Invalid ${label} file path`);
  }

  const maxBytes = options.maxBytes ?? 4096;
  let bytes: Buffer;
  try {
    // Open once: validating a path and reading it later can observe different
    // files if a secret is rotated or the path is replaced between operations.
    // O_NONBLOCK also keeps a replaced FIFO from hanging startup.
    // Absolute secret paths are mounts outside the checkout; ignore them for NFT.
    const secretPath = file;
    const fd = openSync(
      /* turbopackIgnore: true */ secretPath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || (stat.mode & 0o002) !== 0 || stat.size < 1 || stat.size > maxBytes) {
        throw new Error("unsafe secret file");
      }
      const buffer = Buffer.alloc(maxBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const count = readSync(fd, buffer, length, buffer.length - length, null);
        if (count === 0) break;
        length += count;
      }
      if (length < 1 || length > maxBytes) {
        throw new Error("unsafe secret file size");
      }
      bytes = buffer.subarray(0, length);
    } finally {
      closeSync(fd);
    }
  } catch {
    throw new Error(`Could not read safe ${label} file`);
  }
  const value = bytes.toString("utf8").replace(/\r?\n$/, "");
  if (!value || value.includes("\0")) throw new Error(`Invalid ${label} file contents`);
  return value;
}

function integer(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid account mail configuration: ${name}`);
  }
  return parsed;
}

function decodeKey(value: string, label: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error(`Invalid ${label}`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value)
    throw new Error(`Invalid ${label}`);
  return new Uint8Array(decoded);
}

function readActiveMailKeyMaterial(env: Record<string, string | undefined>): {
  activeKeyId: string;
  activeKey: Uint8Array;
} {
  const rawKey = secretSource(
    env,
    "ACCOUNT_MAIL_KEY",
    "ACCOUNT_MAIL_KEY_FILE",
    "account mail encryption key",
    { required: true },
  );
  if (!rawKey) throw new Error("Account mail encryption key is required");
  if (env.AUTH_SECRET && rawKey === env.AUTH_SECRET) {
    throw new Error("Account mail encryption key must not reuse AUTH_SECRET");
  }
  const activeKeyId = required(env, "ACCOUNT_MAIL_KEY_ID");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(activeKeyId)) {
    throw new Error("Invalid account mail key identifier");
  }
  return { activeKeyId, activeKey: decodeKey(rawKey, "account mail encryption key") };
}

function readRecoveryAbuseKeyMaterial(env: Record<string, string | undefined>): Uint8Array {
  const raw = secretSource(
    env,
    "ACCOUNT_RECOVERY_ABUSE_KEY",
    "ACCOUNT_RECOVERY_ABUSE_KEY_FILE",
    "account recovery abuse key",
    { required: true },
  );
  if (!raw) throw new Error("Account recovery abuse key is required");
  if (env.AUTH_SECRET && raw === env.AUTH_SECRET) {
    throw new Error("Account recovery abuse key must not reuse AUTH_SECRET");
  }
  return decodeKey(raw, "account recovery abuse key");
}

function keyFingerprint(label: string, key: Uint8Array, keyId = ""): string {
  return createHash("sha256")
    .update(label)
    .update("\0")
    .update(keyId)
    .update("\0")
    .update(key)
    .digest("hex");
}

let productionProducerPin: { fingerprint: string; cipher: AccountMailCipher } | undefined;
let productionAbusePin: { fingerprint: string; key: Uint8Array } | undefined;

export function readAccountRecoveryAbuseKey(
  env: Record<string, string | undefined> = process.env,
): Uint8Array {
  return readRecoveryAbuseKeyMaterial(env);
}

export function getPinnedAccountRecoveryAbuseKey(
  env: Record<string, string | undefined> = process.env,
): Uint8Array {
  const key = readRecoveryAbuseKeyMaterial(env);
  if (env.NODE_ENV !== "production") return key;

  const fingerprint = keyFingerprint("recovery-abuse", key);
  if (!productionAbusePin) {
    productionAbusePin = { fingerprint, key: new Uint8Array(key) };
  } else if (productionAbusePin.fingerprint !== fingerprint) {
    throw new Error("Account recovery abuse key changed; restart required");
  }
  return new Uint8Array(productionAbusePin.key);
}

export function createAccountMailProducerCipher(
  env: Record<string, string | undefined> = process.env,
): AccountMailCipher {
  const { activeKeyId, activeKey } = readActiveMailKeyMaterial(env);
  return new AccountMailCipher(activeKeyId, Object.freeze({ [activeKeyId]: activeKey }));
}

export function getPinnedAccountMailProducerCipher(
  env: Record<string, string | undefined> = process.env,
): AccountMailCipher {
  const { activeKeyId, activeKey } = readActiveMailKeyMaterial(env);
  if (env.NODE_ENV !== "production") {
    return new AccountMailCipher(activeKeyId, Object.freeze({ [activeKeyId]: activeKey }));
  }

  const fingerprint = keyFingerprint("mail-producer", activeKey, activeKeyId);
  if (!productionProducerPin) {
    productionProducerPin = {
      fingerprint,
      cipher: new AccountMailCipher(activeKeyId, Object.freeze({ [activeKeyId]: activeKey })),
    };
  } else if (productionProducerPin.fingerprint !== fingerprint) {
    throw new Error("Account mail producer key changed; restart required");
  }
  return productionProducerPin.cipher;
}

export function readAccountMailRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): AccountMailRuntimeConfig {
  const { activeKeyId, activeKey } = readActiveMailKeyMaterial(env);
  const previousKeyId = env.ACCOUNT_MAIL_PREVIOUS_KEY_ID || undefined;
  const previousRawKey = secretSource(
    env,
    "ACCOUNT_MAIL_PREVIOUS_KEY",
    "ACCOUNT_MAIL_PREVIOUS_KEY_FILE",
    "previous account mail encryption key",
  );
  if (Boolean(previousKeyId) !== Boolean(previousRawKey)) {
    throw new Error("Previous account mail key ID and key must be configured together");
  }
  if (
    previousKeyId &&
    (!/^[A-Za-z0-9_-]{1,32}$/.test(previousKeyId) || previousKeyId === activeKeyId)
  ) {
    throw new Error("Invalid previous account mail key identifier");
  }
  if (previousRawKey && env.AUTH_SECRET && previousRawKey === env.AUTH_SECRET) {
    throw new Error("Previous account mail encryption key must not reuse AUTH_SECRET");
  }
  const previousKey = previousRawKey
    ? decodeKey(previousRawKey, "previous account mail encryption key")
    : undefined;
  if (previousKey && Buffer.from(previousKey).equals(Buffer.from(activeKey))) {
    throw new Error("Previous account mail encryption key must differ from active key");
  }
  const keys =
    previousKeyId && previousKey
      ? Object.freeze({ [activeKeyId]: activeKey, [previousKeyId]: previousKey })
      : Object.freeze({ [activeKeyId]: activeKey });
  const appUrl = required(env, "ACCOUNT_MAIL_APP_URL");
  const allowLocalHttp = env.NODE_ENV === "development";
  const parsedUrl = parseAccountMailAppUrl(appUrl, allowLocalHttp);
  const smtpHost = required(env, "ACCOUNT_MAIL_SMTP_HOST");
  const smtpModeRaw = env.ACCOUNT_MAIL_SMTP_MODE || "implicit_tls";
  if (smtpModeRaw !== "implicit_tls" && smtpModeRaw !== "starttls") {
    throw new Error("Invalid account mail SMTP mode");
  }
  const smtpMode = smtpModeRaw;
  const smtpServername = required(env, "ACCOUNT_MAIL_SMTP_SERVERNAME");
  const smtpFrom = required(env, "ACCOUNT_MAIL_SMTP_FROM");
  const smtpEnvelopeFrom = env.ACCOUNT_MAIL_SMTP_ENVELOPE_FROM || undefined;
  const smtpAuthModeRaw = env.ACCOUNT_MAIL_SMTP_AUTH_MODE || "auto";
  if (!["auto", "plain", "login"].includes(smtpAuthModeRaw)) {
    throw new Error("Invalid account mail SMTP auth mode");
  }
  const smtpAuthMode = smtpAuthModeRaw as "auto" | "plain" | "login";
  const smtpUsername = env.ACCOUNT_MAIL_SMTP_USERNAME || undefined;
  const smtpPassword = secretSource(
    env,
    "ACCOUNT_MAIL_SMTP_PASSWORD",
    "ACCOUNT_MAIL_SMTP_PASSWORD_FILE",
    "account mail SMTP password",
  );
  if (Boolean(smtpUsername) !== Boolean(smtpPassword)) {
    throw new Error("Account mail SMTP username and password must be configured together");
  }
  const smtpCa = secretSource(
    env,
    "ACCOUNT_MAIL_SMTP_CA",
    "ACCOUNT_MAIL_SMTP_CA_FILE",
    "account mail SMTP CA",
    { maxBytes: 32_768 },
  );
  if (smtpCa !== undefined && smtpCa.length > 32_768)
    throw new Error("Invalid account mail SMTP CA");
  return Object.freeze({
    activeKeyId,
    keys,
    previousKeyId,
    appUrl: parsedUrl.toString().replace(/\/$/, ""),
    allowLocalHttp,
    smtpHost,
    smtpMode,
    smtpPort: integer(
      env.ACCOUNT_MAIL_SMTP_PORT,
      smtpMode === "starttls" ? 587 : 465,
      1,
      65535,
      "ACCOUNT_MAIL_SMTP_PORT",
    ),
    smtpServername,
    smtpFrom,
    smtpEnvelopeFrom,
    smtpAuthMode,
    smtpUsername,
    smtpPassword,
    smtpCa,
    smtpTimeoutMs: integer(
      env.ACCOUNT_MAIL_SMTP_TIMEOUT_MS,
      5_000,
      100,
      30_000,
      "ACCOUNT_MAIL_SMTP_TIMEOUT_MS",
    ),
    batchSize: integer(env.ACCOUNT_MAIL_BATCH_SIZE, 10, 1, 100, "ACCOUNT_MAIL_BATCH_SIZE"),
    pollIntervalMs: integer(
      env.ACCOUNT_MAIL_POLL_INTERVAL_MS,
      5_000,
      100,
      60_000,
      "ACCOUNT_MAIL_POLL_INTERVAL_MS",
    ),
  });
}

export function createAccountMailDispatcher(
  config: AccountMailRuntimeConfig,
): AccountMailDispatcher {
  const cipher = new AccountMailCipher(config.activeKeyId, config.keys);
  const transport = new AccountMailSmtpTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    servername: config.smtpServername,
    from: config.smtpFrom,
    envelopeFrom: config.smtpEnvelopeFrom,
    mode: config.smtpMode,
    authMode: config.smtpAuthMode,
    username: config.smtpUsername,
    password: config.smtpPassword,
    ca: config.smtpCa,
    timeoutMs: config.smtpTimeoutMs,
  });
  return new AccountMailDispatcher({
    cipher,
    transport,
    appUrl: config.appUrl,
    allowLocalHttp: config.allowLocalHttp,
  });
}

export type AccountMailLoopSummary = Readonly<{
  batches: number;
  accepted: number;
  retried: number;
  discarded: number;
  skipped: number;
  unsettled: number;
  cleaned: number;
}>;

export type AccountMailBatchResult = Readonly<{
  accepted: number;
  retried: number;
  discarded: number;
  skipped: number;
  unsettled: number;
  cleaned: number;
  providerDeferred?: boolean;
}>;

type BatchRunner = Readonly<{
  runBatch(
    limit?: number,
    signal?: AbortSignal,
    onProgress?: () => void,
  ): Promise<AccountMailBatchResult>;
}>;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    const onAbort = () => done();
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runAccountMailLoop(input: {
  dispatcher: BatchRunner;
  signal: AbortSignal;
  batchSize: number;
  pollIntervalMs: number;
  once?: boolean;
  onProgress?: () => void;
  onBatch?: (
    input: Readonly<{
      batch: number;
      result: AccountMailBatchResult;
      total: AccountMailLoopSummary;
    }>,
  ) => void | Promise<void>;
}): Promise<AccountMailLoopSummary> {
  if (
    !input?.dispatcher ||
    !input?.signal ||
    !Number.isInteger(input.batchSize) ||
    input.batchSize < 1 ||
    input.batchSize > 100 ||
    !Number.isInteger(input.pollIntervalMs) ||
    input.pollIntervalMs < 100 ||
    input.pollIntervalMs > 60_000
  ) {
    throw new Error("Invalid account mail worker loop configuration");
  }
  const total = {
    batches: 0,
    accepted: 0,
    retried: 0,
    discarded: 0,
    skipped: 0,
    unsettled: 0,
    cleaned: 0,
  };
  do {
    if (input.signal.aborted) break;
    const result = await input.dispatcher.runBatch(input.batchSize, input.signal, input.onProgress);
    total.batches++;
    total.accepted += result.accepted;
    total.retried += result.retried;
    total.discarded += result.discarded;
    total.skipped += result.skipped;
    total.unsettled += result.unsettled;
    total.cleaned += result.cleaned;
    if (input.onBatch) {
      await input.onBatch({
        batch: total.batches,
        result,
        total: Object.freeze({ ...total }),
      });
    }
    if (input.once || input.signal.aborted) break;
    const waitMs = result.providerDeferred
      ? Math.max(input.pollIntervalMs, 30_000)
      : input.pollIntervalMs;
    await sleep(waitMs, input.signal);
  } while (!input.signal.aborted);
  return Object.freeze(total);
}

export function runtimeFingerprint(config: AccountMailRuntimeConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        keyId: config.activeKeyId,
        keyRingSize: Object.keys(config.keys).length,
        appUrl: config.appUrl,
        localHttp: Boolean(config.allowLocalHttp),
        smtpHost: config.smtpHost,
        smtpMode: config.smtpMode,
        smtpPort: config.smtpPort,
        smtpServername: config.smtpServername,
        smtpFrom: config.smtpFrom,
        smtpEnvelopeFrom: config.smtpEnvelopeFrom ?? config.smtpFrom,
        smtpAuth: Boolean(config.smtpUsername),
        smtpAuthMode: config.smtpAuthMode,
        smtpTimeoutMs: config.smtpTimeoutMs,
        batchSize: config.batchSize,
        pollIntervalMs: config.pollIntervalMs,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}
