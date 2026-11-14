import { defineConfig } from "drizzle-kit";

// Forward-only SQL lives under ./migrations. Meta snapshots currently lag the
// journal (ARC14 / OPS-06): do not run plain `drizzle-kit generate` in the main
// checkout. Prefer `pnpm --filter @nexus/db generate:custom` behind
// NEXUS_ALLOW_DB_GENERATE=1 in a disposable checkout, then hand-author the
// delta. Never rewrite applied SQL or journal history. See docs/OPERATIONS.md
// and docs/ARCHITECTURE.md.
export default defineConfig({
  schema: ["./src/schema.ts", "./src/account-recovery-schema.ts", "./src/account-mail-schema.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://nexus:nexus_secret@127.0.0.1:5432/mta_nexus",
  },
});
