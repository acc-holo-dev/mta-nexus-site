import { z } from "zod";

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
  SMTP_HOST: "",
  SMTP_PORT: "1025",
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM: "no-reply@mta-nexus.test",
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
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535),
    SMTP_USER: z.string(),
    SMTP_PASS: z.string(),
    SMTP_FROM: z.string().email(),
  })
  .superRefine((value, ctx) => {
    const addIssue = (path: keyof typeof value, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (Boolean(value.DISCORD_CLIENT_ID) !== Boolean(value.DISCORD_CLIENT_SECRET)) {
      addIssue("DISCORD_CLIENT_SECRET", "Discord client ID and secret must be configured together");
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
        SMTP_HOST: "",
        SMTP_PORT: "1025",
        SMTP_USER: "",
        SMTP_PASS: "",
        SMTP_FROM: "no-reply@nexus-mta.invalid",
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
