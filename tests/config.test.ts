import {
  BUILD_PLACEHOLDER_AUTH_SECRET,
  BUILD_PLACEHOLDER_DATABASE_URL,
  getEnvConfig,
  resolveApplicationOrigin,
} from "@nexus/config";
import { describe, expect, it } from "vitest";
import { configProductionBase } from "./helpers/config-harness";

const productionBase = configProductionBase;

describe("production configuration", () => {
  it.each([
    "https://user:password@nexus.test",
    "https://nexus.test/app",
    "https://nexus.test?override=1",
    "https://nexus.test/#fragment",
    "ftp://nexus.test",
  ])("rejects a non-canonical browser origin %s before serving requests", (url) => {
    expect(() => getEnvConfig({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: url })).toThrow(
      "Invalid configuration parameters",
    );
  });
  it("fails closed when production secrets and providers are missing", () => {
    expect(() => getEnvConfig({ NODE_ENV: "production" })).toThrow(
      "Invalid configuration parameters",
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

  it("allows production email to be explicitly disabled for open free beta", () => {
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
      }),
    ).toThrow("Invalid configuration parameters");
  });

  it("fails closed when production resource scanning is disabled", () => {
    expect(() =>
      getEnvConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
        DATABASE_URL: "postgres://nexus:secret@db:5432/nexus",
        AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
        STORAGE_PROVIDER: "local",
        STORAGE_LOCAL_PATH: "/data/uploads",
        EMAIL_PROVIDER: "disabled",
        BUILD_SCANNER: "disabled",
      }),
    ).toThrow("Invalid configuration parameters");
  });

  it("rejects Dockerfile build-placeholder secrets before HTTP can open", () => {
    const previous = process.env.NEXUS_IMAGE_COMPILE;
    delete process.env.NEXUS_IMAGE_COMPILE;
    try {
      expect(() =>
        getEnvConfig({
          ...productionBase,
          NEXT_PUBLIC_APP_URL: "https://alpha.example.com",
          AUTH_SECRET: BUILD_PLACEHOLDER_AUTH_SECRET,
        }),
      ).toThrow("Invalid configuration parameters");

      expect(() =>
        getEnvConfig({
          ...productionBase,
          NEXT_PUBLIC_APP_URL: "https://alpha.example.com",
          DATABASE_URL: BUILD_PLACEHOLDER_DATABASE_URL,
        }),
      ).toThrow("Invalid configuration parameters");
    } finally {
      if (previous === undefined) delete process.env.NEXUS_IMAGE_COMPILE;
      else process.env.NEXUS_IMAGE_COMPILE = previous;
    }
  });

  it("allows Dockerfile build placeholders only during image compile", () => {
    const previous = process.env.NEXUS_IMAGE_COMPILE;
    process.env.NEXUS_IMAGE_COMPILE = "1";
    try {
      const config = getEnvConfig({
        ...productionBase,
        NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
        AUTH_SECRET: BUILD_PLACEHOLDER_AUTH_SECRET,
        DATABASE_URL: BUILD_PLACEHOLDER_DATABASE_URL,
      });
      expect(config.AUTH_SECRET).toBe(BUILD_PLACEHOLDER_AUTH_SECRET);
      expect(config.DATABASE_URL).toBe(BUILD_PLACEHOLDER_DATABASE_URL);
    } finally {
      if (previous === undefined) delete process.env.NEXUS_IMAGE_COMPILE;
      else process.env.NEXUS_IMAGE_COMPILE = previous;
    }
  });

  it("accepts the same production secrets under two HTTPS runtime origins", () => {
    const origins = ["https://alpha.example.com", "https://beta.example.com"] as const;
    for (const origin of origins) {
      const fromLegacy = getEnvConfig({
        ...productionBase,
        NEXT_PUBLIC_APP_URL: origin,
      });
      const fromCanonical = getEnvConfig({
        ...productionBase,
        APP_URL: origin,
      });
      expect(fromLegacy.NEXT_PUBLIC_APP_URL).toBe(origin);
      expect(fromCanonical.NEXT_PUBLIC_APP_URL).toBe(origin);
      expect(fromLegacy.AUTH_SECRET).toBe(productionBase.AUTH_SECRET);
      expect(fromCanonical.DATABASE_URL).toBe(productionBase.DATABASE_URL);
    }
  });

  it("prefers APP_URL and rejects conflicting origin names", () => {
    expect(
      resolveApplicationOrigin({
        APP_URL: "https://alpha.example.com",
        NEXT_PUBLIC_APP_URL: "https://alpha.example.com",
      }),
    ).toBe("https://alpha.example.com");

    expect(
      getEnvConfig({
        ...productionBase,
        APP_URL: "https://alpha.example.com",
        NEXT_PUBLIC_APP_URL: "https://alpha.example.com",
      }).NEXT_PUBLIC_APP_URL,
    ).toBe("https://alpha.example.com");

    expect(() =>
      getEnvConfig({
        ...productionBase,
        APP_URL: "https://alpha.example.com",
        NEXT_PUBLIC_APP_URL: "https://beta.example.com",
      }),
    ).toThrow("Invalid configuration parameters");
  });
});
