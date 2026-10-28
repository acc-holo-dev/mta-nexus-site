import { pathToFileURL } from "node:url";
import { config } from "@nexus/config";
import { hashPassword } from "@nexus/security";
import { ensureSeedArchives } from "./seed-archive";
import { createSeedData } from "./seed-data";
import { seedBaseline, type SeedOptions } from "./seed-baseline";

export async function runSeed(options: SeedOptions = {}) {
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
