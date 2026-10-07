import { ECDH, createECDH, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
function decodeBase64Url(value: string): Uint8Array | null {
  if (!BASE64URL_PATTERN.test(value)) return null;
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/gu, "+").replace(/_/gu, "/");
  try {
    const raw = atob(base64);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function isValidWebPushP256PublicKey(value: string): boolean {
  const decoded = decodeBase64Url(value);
  if (decoded?.length !== 65 || decoded[0] !== 0x04) return false;
  try {
    const normalized = ECDH.convertKey(
      Buffer.from(decoded),
      "prime256v1",
      undefined,
      undefined,
      "uncompressed",
    );
    return normalized.length === 65 && normalized[0] === 0x04;
  } catch {
    return false;
  }
}

export function isValidWebPushAuthSecret(value: string): boolean {
  return decodeBase64Url(value)?.length === 16;
}

export function isValidWebPushP256PrivateKey(value: string): boolean {
  const decoded = decodeBase64Url(value);
  if (decoded?.length !== 32) return false;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(decoded));
    return ecdh.getPublicKey(undefined, "uncompressed").length === 65;
  } catch {
    return false;
  }
}

export function isMatchingWebPushVapidKeyPair(
  publicKey: string,
  privateKey: string,
): boolean {
  const decodedPublic = decodeBase64Url(publicKey);
  const decodedPrivate = decodeBase64Url(privateKey);
  if (
    decodedPublic?.length !== 65 ||
    decodedPublic[0] !== 0x04 ||
    decodedPrivate?.length !== 32
  ) {
    return false;
  }

  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(decodedPrivate));
    const derived = ecdh.getPublicKey(undefined, "uncompressed");
    const supplied = Buffer.from(decodedPublic);
    return (
      derived.length === supplied.length &&
      timingSafeEqual(derived, supplied)
    );
  } catch {
    return false;
  }
}

export function isValidVapidSubject(value: string): boolean {
  try {
    const subject = new URL(value);
    if (subject.protocol === "https:") return Boolean(subject.hostname);
    return subject.protocol === "mailto:" && subject.pathname.includes("@");
  } catch {
    return false;
  }
}

export type WebPushVapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function readWebPushVapidConfig(
  env: Record<string, string | undefined> = process.env,
): WebPushVapidConfig | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.WEB_PUSH_VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey && !privateKey && !subject) return null;
  if (
    !publicKey ||
    !privateKey ||
    !subject ||
    !isValidWebPushP256PublicKey(publicKey) ||
    !isValidWebPushP256PrivateKey(privateKey) ||
    !isMatchingWebPushVapidKeyPair(publicKey, privateKey) ||
    !isValidVapidSubject(subject)
  ) {
    throw new Error("Invalid Web Push VAPID configuration");
  }
  return { publicKey, privateKey, subject };
}

const developmentDefaults = {
  NODE_ENV: "development",
  PORT: "3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://nexus:nexus_secret@127.0.0.1:5432/mta_nexus",
  AUTH_SECRET: "development-only-secret-change-before-production",
  DISCORD_CLIENT_ID: "",
  DISCORD_CLIENT_SECRET: "",
  STORAGE_PROVIDER: "local",
  STORAGE_LOCAL_PATH: "./uploads",
  STORAGE_S3_ENDPOINT: "",
  STORAGE_S3_BUCKET: "",
  STORAGE_S3_ACCESS_KEY: "",
  STORAGE_S3_SECRET_KEY: "",
  STORAGE_S3_REGION: "us-east-1",
  EMAIL_PROVIDER: "log",
  BUILD_SCANNER: "disabled",
  CLAMAV_HOST: "",
  CLAMAV_PORT: "3310",
  SMTP_HOST: "",
  SMTP_PORT: "1025",
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM: "no-reply@mta-nexus.test",
  WEB_PUSH_VAPID_PUBLIC_KEY: "",
  WEB_PUSH_VAPID_PRIVATE_KEY: "",
  WEB_PUSH_VAPID_SUBJECT: "",
} as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().positive().max(65535),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string(),
    STORAGE_PROVIDER: z.enum(["local", "s3"]),
    STORAGE_LOCAL_PATH: z.string(),
    STORAGE_S3_ENDPOINT: z.string(),
    STORAGE_S3_BUCKET: z.string(),
    STORAGE_S3_ACCESS_KEY: z.string(),
    STORAGE_S3_SECRET_KEY: z.string(),
    STORAGE_S3_REGION: z.string(),
    EMAIL_PROVIDER: z.enum(["disabled", "log", "smtp"]),
    BUILD_SCANNER: z.enum(["disabled", "clamav"]),
    CLAMAV_HOST: z.string(),
    CLAMAV_PORT: z.coerce.number().int().positive().max(65535),
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535),
    SMTP_USER: z.string(),
    SMTP_PASS: z.string(),
    SMTP_FROM: z.string().email(),
    WEB_PUSH_VAPID_PUBLIC_KEY: z.string(),
    WEB_PUSH_VAPID_PRIVATE_KEY: z.string(),
    WEB_PUSH_VAPID_SUBJECT: z.string(),
  })
  .superRefine((value, ctx) => {
    const addIssue = (path: keyof typeof value, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (Boolean(value.DISCORD_CLIENT_ID) !== Boolean(value.DISCORD_CLIENT_SECRET)) {
      addIssue("DISCORD_CLIENT_SECRET", "Discord client ID and secret must be configured together");
    }

    const webPushConfigured = [
      value.WEB_PUSH_VAPID_PUBLIC_KEY,
      value.WEB_PUSH_VAPID_PRIVATE_KEY,
      value.WEB_PUSH_VAPID_SUBJECT,
    ].filter(Boolean).length;
    if (webPushConfigured !== 0 && webPushConfigured !== 3) {
      addIssue(
        "WEB_PUSH_VAPID_PUBLIC_KEY",
        "Web Push VAPID public key, private key and subject must be configured together",
      );
    }
    if (
      value.WEB_PUSH_VAPID_PUBLIC_KEY &&
      !isValidWebPushP256PublicKey(value.WEB_PUSH_VAPID_PUBLIC_KEY)
    ) {
      addIssue(
        "WEB_PUSH_VAPID_PUBLIC_KEY",
        "Web Push public key must be an uncompressed P-256 public key",
      );
    }
    if (
      value.WEB_PUSH_VAPID_PRIVATE_KEY &&
      !isValidWebPushP256PrivateKey(value.WEB_PUSH_VAPID_PRIVATE_KEY)
    ) {
      addIssue(
        "WEB_PUSH_VAPID_PRIVATE_KEY",
        "Web Push private key must be a valid P-256 scalar",
      );
    }
    if (
      value.WEB_PUSH_VAPID_PUBLIC_KEY &&
      value.WEB_PUSH_VAPID_PRIVATE_KEY &&
      isValidWebPushP256PublicKey(value.WEB_PUSH_VAPID_PUBLIC_KEY) &&
      isValidWebPushP256PrivateKey(value.WEB_PUSH_VAPID_PRIVATE_KEY) &&
      !isMatchingWebPushVapidKeyPair(
        value.WEB_PUSH_VAPID_PUBLIC_KEY,
        value.WEB_PUSH_VAPID_PRIVATE_KEY,
      )
    ) {
      addIssue(
        "WEB_PUSH_VAPID_PRIVATE_KEY",
        "Web Push VAPID public and private keys must form the same P-256 key pair",
      );
    }
    if (
      value.WEB_PUSH_VAPID_SUBJECT &&
      !isValidVapidSubject(value.WEB_PUSH_VAPID_SUBJECT)
    ) {
      addIssue(
        "WEB_PUSH_VAPID_SUBJECT",
        "Web Push VAPID subject must use mailto: or HTTPS",
      );
    }

    if (value.STORAGE_PROVIDER === "local" && !value.STORAGE_LOCAL_PATH) {
      addIssue("STORAGE_LOCAL_PATH", "Local storage requires an explicit path");
    }

    if (value.STORAGE_PROVIDER === "s3") {
      for (const key of [
        "STORAGE_S3_ENDPOINT",
        "STORAGE_S3_BUCKET",
        "STORAGE_S3_ACCESS_KEY",
        "STORAGE_S3_SECRET_KEY",
        "STORAGE_S3_REGION",
      ] as const) {
        if (!value[key]) addIssue(key, "S3 storage requires this value");
      }
    }

    if (value.EMAIL_PROVIDER === "smtp" && (!value.SMTP_HOST || !value.SMTP_FROM)) {
      addIssue("SMTP_HOST", "SMTP email requires a host and sender address");
    }
    if (value.BUILD_SCANNER === "clamav" && !value.CLAMAV_HOST) {
      addIssue("CLAMAV_HOST", "ClamAV scanning requires a host");
    }

    if (value.NODE_ENV === "production") {
      const appUrl = new URL(value.NEXT_PUBLIC_APP_URL);
      if (appUrl.protocol !== "https:") {
        addIssue("NEXT_PUBLIC_APP_URL", "Production application URL must use HTTPS");
      }
      if (appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1") {
        addIssue("NEXT_PUBLIC_APP_URL", "Production application URL cannot point to localhost");
      }
      if (value.STORAGE_PROVIDER === "local" && !value.STORAGE_LOCAL_PATH.startsWith("/")) {
        addIssue("STORAGE_LOCAL_PATH", "Production local storage must use an absolute mounted path");
      }
      if (value.EMAIL_PROVIDER === "log") {
        addIssue("EMAIL_PROVIDER", "Production email must be disabled or use SMTP");
      }
      if (value.BUILD_SCANNER !== "clamav") {
        addIssue("BUILD_SCANNER", "Production resource publishing requires ClamAV");
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function getEnvConfig(env: Record<string, string | undefined> = process.env): EnvConfig {
  const isProduction = env.NODE_ENV === "production";
  const input = isProduction
    ? {
        NODE_ENV: "production",
        PORT: "3000",
        DISCORD_CLIENT_ID: "",
        DISCORD_CLIENT_SECRET: "",
        STORAGE_LOCAL_PATH: "",
        STORAGE_S3_ENDPOINT: "",
        STORAGE_S3_BUCKET: "",
        STORAGE_S3_ACCESS_KEY: "",
        STORAGE_S3_SECRET_KEY: "",
        STORAGE_S3_REGION: "us-east-1",
        EMAIL_PROVIDER: "disabled",
        BUILD_SCANNER: "disabled",
        CLAMAV_HOST: "",
        CLAMAV_PORT: "3310",
        SMTP_HOST: "",
        SMTP_PORT: "1025",
        SMTP_USER: "",
        SMTP_PASS: "",
        SMTP_FROM: "no-reply@nexus-mta.invalid",
        WEB_PUSH_VAPID_PUBLIC_KEY: "",
        WEB_PUSH_VAPID_PRIVATE_KEY: "",
        WEB_PUSH_VAPID_SUBJECT: "",
        ...env,
      }
    : { ...developmentDefaults, ...env };

  const result = envSchema.safeParse(input);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    throw new Error("Invalid configuration parameters");
  }
  return result.data;
}

export const config = getEnvConfig();
