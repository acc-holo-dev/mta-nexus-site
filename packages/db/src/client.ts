import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@nexus/config";
import * as schema from "./schema";

// Connection pool singleton
const queryClient = postgres(config.DATABASE_URL, {
  max: process.env.VERCEL ? 1 : 10,
  prepare: process.env.VERCEL ? false : undefined,
  ssl: config.NODE_ENV === "production" ? "require" : undefined,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export async function checkDatabaseConnection(): Promise<void> {
  await queryClient`SELECT 1`;
}

export * from "./schema";
