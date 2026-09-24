import { createHash } from "node:crypto";
import { AccountMailCipher } from "./account-mail-crypto";
import { AccountMailDispatcher } from "./account-mail-dispatcher";
import { AccountMailSmtpTransport } from "./account-mail-smtp";

export type AccountMailRuntimeConfig = Readonly<{
  activeKeyId: string;
  keys: Readonly<Record<string, Uint8Array>>;
  appUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpServername: string;
  smtpFrom: string;
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

function integer(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid account mail configuration: ${name}`);
  }
  return parsed;
}

function decodeKey(value: string, label: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error(`Invalid ${label}`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) throw new Error(`Invalid ${label}`);
  return new Uint8Array(decoded);
}

export function readAccountRecoveryAbuseKey(
  env: Record<string, string | undefined> = process.env,
): Uint8Array {
  const raw = required(env, "ACCOUNT_RECOVERY_ABUSE_KEY");
  if (env.AUTH_SECRET && raw === env.AUTH_SECRET) {
    throw new Error("Account recovery abuse key must not reuse AUTH_SECRET");
  }
  return decodeKey(raw, "account recovery abuse key");
}

export function createAccountMailProducerCipher(
  env: Record<string, string | undefined> = process.env,
): AccountMailCipher {
  const rawKey = required(env, "ACCOUNT_MAIL_KEY");
  if (env.AUTH_SECRET && rawKey === env.AUTH_SECRET) {
    throw new Error("Account mail encryption key must not reuse AUTH_SECRET");
  }
  const activeKeyId = required(env, "ACCOUNT_MAIL_KEY_ID");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(activeKeyId)) throw new Error("Invalid account mail key identifier");
  const activeKey = decodeKey(rawKey, "account mail encryption key");
  return new AccountMailCipher(activeKeyId, Object.freeze({ [activeKeyId]: activeKey }));
}

export function readAccountMailRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): AccountMailRuntimeConfig {
  const rawKey = required(env, "ACCOUNT_MAIL_KEY");
  if (env.AUTH_SECRET && rawKey === env.AUTH_SECRET) {
    throw new Error("Account mail encryption key must not reuse AUTH_SECRET");
  }
  const activeKeyId = required(env, "ACCOUNT_MAIL_KEY_ID");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(activeKeyId)) throw new Error("Invalid account mail key identifier");
  const activeKey = decodeKey(rawKey, "account mail encryption key");
  const appUrl = required(env, "ACCOUNT_MAIL_APP_URL");
  const parsedUrl = new URL(appUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error("Invalid account mail application URL");
  }
  const smtpHost = required(env, "ACCOUNT_MAIL_SMTP_HOST");
  const smtpServername = required(env, "ACCOUNT_MAIL_SMTP_SERVERNAME");
  const smtpFrom = required(env, "ACCOUNT_MAIL_SMTP_FROM");
  const smtpCa = env.ACCOUNT_MAIL_SMTP_CA;
  if (smtpCa !== undefined && smtpCa.length > 32_768) throw new Error("Invalid account mail SMTP CA");
  return Object.freeze({
    activeKeyId,
    keys: Object.freeze({ [activeKeyId]: activeKey }),
    appUrl: parsedUrl.toString().replace(/\/$/, ""),
    smtpHost,
    smtpPort: integer(env.ACCOUNT_MAIL_SMTP_PORT, 465, 1, 65535, "ACCOUNT_MAIL_SMTP_PORT"),
    smtpServername,
    smtpFrom,
    smtpCa,
    smtpTimeoutMs: integer(env.ACCOUNT_MAIL_SMTP_TIMEOUT_MS, 5_000, 100, 30_000, "ACCOUNT_MAIL_SMTP_TIMEOUT_MS"),
    batchSize: integer(env.ACCOUNT_MAIL_BATCH_SIZE, 10, 1, 100, "ACCOUNT_MAIL_BATCH_SIZE"),
    pollIntervalMs: integer(env.ACCOUNT_MAIL_POLL_INTERVAL_MS, 5_000, 100, 60_000, "ACCOUNT_MAIL_POLL_INTERVAL_MS"),
  });
}

export function createAccountMailDispatcher(config: AccountMailRuntimeConfig): AccountMailDispatcher {
  const cipher = new AccountMailCipher(config.activeKeyId, config.keys);
  const transport = new AccountMailSmtpTransport({
    host: config.smtpHost, port: config.smtpPort, servername: config.smtpServername,
    from: config.smtpFrom, ca: config.smtpCa, timeoutMs: config.smtpTimeoutMs,
  });
  return new AccountMailDispatcher({ cipher, transport, appUrl: config.appUrl });
}

export type AccountMailLoopSummary = Readonly<{
  batches: number; accepted: number; retried: number; discarded: number;
  skipped: number; unsettled: number; cleaned: number;
}>;

type BatchRunner = Readonly<{
  runBatch(limit?: number): Promise<Readonly<{
    accepted: number; retried: number; discarded: number;
    skipped: number; unsettled: number; cleaned: number;
  }>>;
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
  dispatcher: BatchRunner; signal: AbortSignal; batchSize: number; pollIntervalMs: number; once?: boolean;
}): Promise<AccountMailLoopSummary> {
  if (!input?.dispatcher || !input?.signal
    || !Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 100
    || !Number.isInteger(input.pollIntervalMs) || input.pollIntervalMs < 100 || input.pollIntervalMs > 60_000) {
    throw new Error("Invalid account mail worker loop configuration");
  }
  const total = { batches: 0, accepted: 0, retried: 0, discarded: 0, skipped: 0, unsettled: 0, cleaned: 0 };
  do {
    if (input.signal.aborted) break;
    const result = await input.dispatcher.runBatch(input.batchSize);
    total.batches++;
    total.accepted += result.accepted;
    total.retried += result.retried;
    total.discarded += result.discarded;
    total.skipped += result.skipped;
    total.unsettled += result.unsettled;
    total.cleaned += result.cleaned;
    if (input.once || input.signal.aborted) break;
    await sleep(input.pollIntervalMs, input.signal);
  } while (!input.signal.aborted);
  return Object.freeze(total);
}

export function runtimeFingerprint(config: AccountMailRuntimeConfig): string {
  return createHash("sha256").update(JSON.stringify({
    keyId: config.activeKeyId, appUrl: config.appUrl, smtpHost: config.smtpHost,
    smtpPort: config.smtpPort, smtpServername: config.smtpServername, smtpFrom: config.smtpFrom,
    smtpTimeoutMs: config.smtpTimeoutMs, batchSize: config.batchSize, pollIntervalMs: config.pollIntervalMs,
  })).digest("hex").slice(0, 16);
}
