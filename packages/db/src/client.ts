import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@nexus/config";
import * as schema from "./schema";

// Connection pool singleton
const queryClient = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export * from "./schema";
