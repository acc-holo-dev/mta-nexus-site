import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const migrationsFolder = path.resolve(__dirname, "../migrations");
  console.log(`Applying migrations from ${migrationsFolder}...`);
  try {
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied successfully.");
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  }
}

// If run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
