import { pathToFileURL } from "node:url";
import { config } from "@nexus/config";
import { hashPassword } from "@nexus/security";
import { ensureSeedArchives } from "./seed-archive";
import { type SeedOptions, seedBaseline } from "./seed-baseline";
import { createSeedData } from "./seed-data";
import { assertDevelopmentSeedAllowed } from "./seed-safety";

// Baseline demo seed does not insert resource Q&A rows (migration 0089).
// Use `pnpm db:seed:historical` when local UI needs Q&A threads/answers/follows.

export async function runSeed(
  options: SeedOptions = {},
  environment: Record<string, string | undefined> = process.env,
) {
  assertDevelopmentSeedAllowed(config, environment);
  const archives = await ensureSeedArchives(config);
  const passwordHash = await hashPassword("password123");
  const result = await seedBaseline(createSeedData(passwordHash, archives), options);
  console.log("Development seed completed:", result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const allowed = new Set(["--repair-demo-builds", "--repair-demo-media"]);
  if (args.some((arg) => !allowed.has(arg))) {
    console.error("Usage: seed [--repair-demo-builds] [--repair-demo-media]");
    process.exit(1);
  }
  runSeed({
    repairDemoBuilds: args.includes("--repair-demo-builds"),
    repairDemoMedia: args.includes("--repair-demo-media"),
  })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seed error:", error);
      process.exit(1);
    });
}
