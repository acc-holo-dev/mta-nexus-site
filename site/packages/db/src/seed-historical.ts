import { pathToFileURL } from "node:url";
import { config } from "@nexus/config";
import { hashPassword } from "@nexus/security";
import { seedHistorical } from "./historical-seed";
import { assertDevelopmentSeedAllowed } from "./seed-safety";

export async function runHistoricalSeed(
  environment: Record<string, string | undefined> = process.env,
) {
  assertDevelopmentSeedAllowed(config, environment);
  const passwordHash = await hashPassword("password123");
  const result = await seedHistorical({ passwordHash });
  console.log("Historical seed completed:", result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 2) {
    console.error("Usage: seed-historical");
    process.exit(1);
  }
  runHistoricalSeed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Historical seed error:", error);
      process.exit(1);
    });
}
