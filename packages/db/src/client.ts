import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readDatabaseUrl } from "./database-config";
import * as schema from "./schema";

// Connection pool singleton
const queryClient = postgres(readDatabaseUrl(), {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

// Drizzle's postgres-js adapter replaces the driver's timestamp serializers
// (OIDs 1184/1114/…) with a transparent `val => val` passthrough. That is fine
// for string/number params, but raw `sql` templates in repositories pass real
// `Date` objects (e.g. `expires_at > ${now}`). With the passthrough the Date
// reaches postgres.js Bind unserialized and dies in Buffer.byteLength with
// ERR_INVALID_ARG_TYPE ("Received an instance of Date"), which broke every
// library/cart/order query. Restore Date-aware serialization for the same OIDs
// Drizzle clobbered, leaving its result-parsing behaviour untouched.
const dateAwareSerializer = (value: unknown): unknown =>
  value instanceof Date ? value.toISOString() : value;
for (const type of ["1184", "1082", "1083", "1114", "1182", "1185", "1115", "1231"]) {
  if (queryClient.options.serializers[type]) {
    queryClient.options.serializers[type] = dateAwareSerializer;
  }
}

export async function checkDatabaseConnection(): Promise<void> {
  await queryClient`SELECT 1`;
}

export async function closeDatabaseConnection(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}

export * from "./schema";
