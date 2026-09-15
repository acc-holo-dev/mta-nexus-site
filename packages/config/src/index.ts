import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("postgres://nexus:nexus_secret@localhost:5432/mta_nexus"),
  AUTH_SECRET: z.string().min(16).default("super-secure-random-32-character-secret-key-mta-nexus"),
  DISCORD_CLIENT_ID: z.string().optional().default(""),
  DISCORD_CLIENT_SECRET: z.string().optional().default(""),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  STORAGE_S3_ENDPOINT: z.string().optional().default("http://localhost:9000"),
  STORAGE_S3_BUCKET: z.string().default("nexus-assets"),
  STORAGE_S3_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_S3_SECRET_KEY: z.string().optional().default(""),
  STORAGE_S3_REGION: z.string().default("us-east-1"),
  EMAIL_PROVIDER: z.enum(["log", "smtp"]).default("log"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().email().default("no-reply@mta-nexus.com"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function getEnvConfig(env: Record<string, string | undefined> = process.env): EnvConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error("Invalid configuration parameters");
  }
  return result.data;
}

export const config = getEnvConfig();
