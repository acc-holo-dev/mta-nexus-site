import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// One source of pinned versions; browser tools stay outside the application.
const playwright = "@playwright/test@1.62.1";
const axeVersion = "4.13.0";
const profiles = new Map([
  ["basic", [playwright]],
  ["a11y", [playwright, `@axe-core/playwright@${axeVersion}`, `axe-core@${axeVersion}`]],
  ["agent", [playwright, "agent-browser@0.33.2"]],
]);

export function installBrowserTools(profile, directory, run = spawnSync) {
  const packages = profiles.get(profile);
  if (!packages) throw new Error("Browser tool profile must be basic, a11y or agent");
  if (typeof directory !== "string" || !isAbsolute(directory)) throw new Error("Browser tool directory must be absolute");
  const result = run("npm", [
    "install", "--prefix", directory, "--no-audit", "--no-fund", "--save-exact", ...packages,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = installBrowserTools(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Browser tool installation failed");
    process.exitCode = 1;
  }
}
