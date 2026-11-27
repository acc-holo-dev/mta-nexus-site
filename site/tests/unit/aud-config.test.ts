import { getEnvConfig } from "@nexus/config";
import { describe, expect, it } from "vitest";

const productionBase = {
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://nexus.example.com",
  DATABASE_URL: "postgres://nexus:secret@db.example.com:5432/nexus",
  AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
  STORAGE_PROVIDER: "local",
  STORAGE_LOCAL_PATH: "/data/uploads",
  EMAIL_PROVIDER: "disabled",
  BUILD_SCANNER: "clamav",
  CLAMAV_HOST: "clamav",
} as const;

describe("production origin loopback", () => {
  it.each([
    "https://[::1]/",
    "https://127.0.0.2/",
    "https://localhost./",
    "https://[::ffff:127.0.0.1]/",
  ])("rejects loopback origin %s", (origin) => {
    expect(() => getEnvConfig({ ...productionBase, NEXT_PUBLIC_APP_URL: origin })).toThrow(
      "Invalid configuration parameters",
    );
  });

  it("accepts a public origin in the same record shapes", () => {
    expect(getEnvConfig(productionBase).NEXT_PUBLIC_APP_URL).toBe("https://nexus.example.com");
    expect(
      getEnvConfig({ ...productionBase, NEXT_PUBLIC_APP_URL: "https://nexus.example.com./" })
        .NEXT_PUBLIC_APP_URL,
    ).toBe("https://nexus.example.com./");
    expect(
      getEnvConfig({ ...productionBase, NEXT_PUBLIC_APP_URL: "https://203.0.113.10/" })
        .NEXT_PUBLIC_APP_URL,
    ).toBe("https://203.0.113.10/");
    expect(
      getEnvConfig({ ...productionBase, NEXT_PUBLIC_APP_URL: "https://[2001:db8::1]/" })
        .NEXT_PUBLIC_APP_URL,
    ).toBe("https://[2001:db8::1]/");
  });
});

describe("production SMTP sender", () => {
  it("rejects SMTP with a host and no sender", () => {
    expect(() =>
      getEnvConfig({
        ...productionBase,
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.com",
      }),
    ).toThrow("Invalid configuration parameters");

    expect(() =>
      getEnvConfig({
        ...productionBase,
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "",
      }),
    ).toThrow("Invalid configuration parameters");

    expect(() =>
      getEnvConfig({
        ...productionBase,
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "   ",
      }),
    ).toThrow("Invalid configuration parameters");
  });

  it("keeps an explicit sender and still allows email to stay disabled", () => {
    const smtp = getEnvConfig({
      ...productionBase,
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_FROM: "noreply@example.com",
    });
    expect(smtp.EMAIL_PROVIDER).toBe("smtp");
    expect(smtp.SMTP_HOST).toBe("smtp.example.com");
    expect(smtp.SMTP_FROM).toBe("noreply@example.com");

    const disabled = getEnvConfig(productionBase);
    expect(disabled.EMAIL_PROVIDER).toBe("disabled");
    expect(disabled.SMTP_FROM).not.toBe("");
  });
});

describe("production secret length", () => {
  it("rejects whitespace-only database URL and auth secret", () => {
    expect(() => getEnvConfig({ ...productionBase, DATABASE_URL: " " })).toThrow(
      "Invalid configuration parameters",
    );
    expect(() => getEnvConfig({ ...productionBase, AUTH_SECRET: " ".repeat(32) })).toThrow(
      "Invalid configuration parameters",
    );
  });

  it("accepts a non-blank database URL and a 32-character secret", () => {
    const secret = "a".repeat(32);
    const config = getEnvConfig({ ...productionBase, AUTH_SECRET: secret });
    expect(config.DATABASE_URL).toBe(productionBase.DATABASE_URL);
    expect(config.AUTH_SECRET).toBe(secret);
  });
});
