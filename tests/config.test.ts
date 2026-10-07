import { Buffer } from "node:buffer";
import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getEnvConfig,
  readWebPushVapidConfig,
} from "@nexus/config";

function vapidKeyPair() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"),
    privateKey: ecdh.getPrivateKey().toString("base64url"),
  };
}

describe("production configuration", () => {
  it("fails closed when production secrets and providers are missing", () => {
    expect(() => getEnvConfig({ NODE_ENV: "production" })).toThrow(
      "Invalid configuration parameters"
    );
  });

  it("accepts an explicit production configuration", () => {
    const config = getEnvConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://nexus.example.com",
      DATABASE_URL: "postgres://nexus:secret@db.example.com:5432/nexus",
      AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
      STORAGE_PROVIDER: "s3",
      STORAGE_S3_ENDPOINT: "https://storage.example.com",
      STORAGE_S3_BUCKET: "nexus-assets",
      STORAGE_S3_ACCESS_KEY: "access-key",
      STORAGE_S3_SECRET_KEY: "secret-key",
      STORAGE_S3_REGION: "eu-central-1",
      EMAIL_PROVIDER: "smtp",
      BUILD_SCANNER: "clamav",
      CLAMAV_HOST: "clamav.internal",
      SMTP_HOST: "smtp.example.com",
      SMTP_FROM: "noreply@example.com",
    });

    expect(config.NODE_ENV).toBe("production");
    expect(config.STORAGE_PROVIDER).toBe("s3");
    expect(config.EMAIL_PROVIDER).toBe("smtp");
  });

  it("allows production email to be explicitly disabled for closed beta", () => {
    const config = getEnvConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
      DATABASE_URL: "postgres://nexus:secret@db.example.com:5432/nexus",
      AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
      STORAGE_PROVIDER: "local",
      STORAGE_LOCAL_PATH: "/var/lib/mta-nexus/uploads",
      EMAIL_PROVIDER: "disabled",
      BUILD_SCANNER: "clamav",
      CLAMAV_HOST: "clamav",
    });

    expect(config.EMAIL_PROVIDER).toBe("disabled");
  });

  it("rejects localhost and log-only email in production", () => {
    expect(() =>
      getEnvConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        DATABASE_URL: "postgres://nexus:secret@db:5432/nexus",
        AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
        STORAGE_PROVIDER: "local",
        STORAGE_LOCAL_PATH: "./uploads",
        EMAIL_PROVIDER: "log",
      })
    ).toThrow("Invalid configuration parameters");
  });

  it("fails closed when production resource scanning is disabled", () => {
    expect(() => getEnvConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
      DATABASE_URL: "postgres://nexus:secret@db:5432/nexus",
      AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
      STORAGE_PROVIDER: "local",
      STORAGE_LOCAL_PATH: "/data/uploads",
      EMAIL_PROVIDER: "disabled",
      BUILD_SCANNER: "disabled",
    })).toThrow("Invalid configuration parameters");
  });
});


describe("Web Push VAPID configuration", () => {
  const pair = vapidKeyPair();
  const valid = {
    WEB_PUSH_VAPID_PUBLIC_KEY: pair.publicKey,
    WEB_PUSH_VAPID_PRIVATE_KEY: pair.privateKey,
    WEB_PUSH_VAPID_SUBJECT: "mailto:ops@nexus.example.com",
  };

  it("accepts a complete VAPID triplet", () => {
    expect(readWebPushVapidConfig(valid)).toEqual({
      publicKey: valid.WEB_PUSH_VAPID_PUBLIC_KEY,
      privateKey: valid.WEB_PUSH_VAPID_PRIVATE_KEY,
      subject: valid.WEB_PUSH_VAPID_SUBJECT,
    });
  });

  it("treats an entirely absent VAPID configuration as disabled", () => {
    expect(readWebPushVapidConfig({})).toBeNull();
  });

  it("rejects a public key that does not match the private key", () => {
    const otherPair = vapidKeyPair();
    expect(() =>
      readWebPushVapidConfig({
        ...valid,
        WEB_PUSH_VAPID_PUBLIC_KEY: otherPair.publicKey,
      }),
    ).toThrow("Invalid Web Push VAPID configuration");
  });

  it("rejects partial and malformed VAPID configuration", () => {
    expect(() =>
      readWebPushVapidConfig({
        WEB_PUSH_VAPID_PUBLIC_KEY: valid.WEB_PUSH_VAPID_PUBLIC_KEY,
      }),
    ).toThrow("Invalid Web Push VAPID configuration");

    expect(() =>
      readWebPushVapidConfig({
        ...valid,
        WEB_PUSH_VAPID_PRIVATE_KEY: Buffer.from(
          new Uint8Array(32),
        ).toString("base64url"),
      }),
    ).toThrow("Invalid Web Push VAPID configuration");

    expect(() =>
      readWebPushVapidConfig({
        ...valid,
        WEB_PUSH_VAPID_SUBJECT: "http://nexus.example.com",
      }),
    ).toThrow("Invalid Web Push VAPID configuration");
  });

  it("makes the production schema reject partial VAPID configuration", () => {
    expect(() =>
      getEnvConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
        DATABASE_URL: "postgres://nexus:secret@db.example.com:5432/nexus",
        AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
        STORAGE_PROVIDER: "local",
        STORAGE_LOCAL_PATH: "/data/uploads",
        EMAIL_PROVIDER: "disabled",
        BUILD_SCANNER: "clamav",
        CLAMAV_HOST: "clamav",
        WEB_PUSH_VAPID_PUBLIC_KEY: valid.WEB_PUSH_VAPID_PUBLIC_KEY,
      }),
    ).toThrow("Invalid configuration parameters");
  });
});
