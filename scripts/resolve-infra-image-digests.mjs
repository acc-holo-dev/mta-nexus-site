#!/usr/bin/env node
/**
 * OPS-03 helper: resolve selected base/infra image digests for a release candidate.
 * Writes deploy/infra-image-pins.json with status=resolved. Does not push images,
 * change Compose tags, or set productionAuthorized.
 *
 * Usage:
 *   node scripts/resolve-infra-image-digests.mjs [--platform os/arch[/variant]] [--dry-run]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateInfraImagePins,
  INFRA_IMAGE_REFS,
  isImageDigest,
  isImagePlatform,
} from "./infra-image-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pinPath = join(root, "deploy/infra-image-pins.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const platformIndex = args.indexOf("--platform");
const platform = platformIndex >= 0 ? args[platformIndex + 1] : "linux/amd64";
if (!isImagePlatform(platform)) {
  console.error("Platform must have the form os/arch or os/arch/variant.");
  process.exit(1);
}
const [osName, arch, variant] = platform.split("/");

function resolveDigest(ref) {
  const result = spawnSync("docker", ["buildx", "imagetools", "inspect", ref, "--raw"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`imagetools inspect failed for ${ref}: ${result.stderr || result.stdout}`);
  }
  let index;
  try {
    index = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid manifest index for ${ref}`);
  }
  if (!Array.isArray(index?.manifests)) {
    throw new Error(`No manifest index for ${ref}`);
  }
  const matches = index.manifests.filter(
    (entry) =>
      entry?.platform?.os === osName &&
      entry.platform.architecture === arch &&
      (variant === undefined || entry.platform.variant === variant),
  );
  if (matches.length === 0) {
    throw new Error(`No ${platform} digest found for ${ref}`);
  }
  if (matches.length !== 1 || !isImageDigest(matches[0].digest)) {
    throw new Error(`Ambiguous or invalid ${platform} digest for ${ref}`);
  }
  return matches[0].digest;
}

const document = JSON.parse(readFileSync(pinPath, "utf8"));
const images = Object.entries(INFRA_IMAGE_REFS).map(([role, ref]) => {
  const digest = resolveDigest(ref);
  return {
    role,
    ref,
    digest,
    platform,
    status: "resolved",
    ...(role === "postgres"
      ? {
          note: "Preserve major 18 and /var/lib/postgresql mount; major engine upgrade is out of band.",
        }
      : role === "node"
        ? {
            note: "Dockerfile development/build/runtime stages follow node:26-alpine; host/CI exact pin remains in .nvmrc.",
          }
        : {}),
  };
});

const next = {
  ...document,
  productionAuthorized: false,
  images,
  observedAtPrep: {
    note: "Resolved via docker buildx imagetools; still not a production deploy authorization.",
    platform,
    captured: true,
    digests: Object.fromEntries(images.map((entry) => [entry.role, entry.digest])),
  },
};

const evaluation = evaluateInfraImagePins(next, { requireResolved: true });
if (!evaluation.ok) {
  console.error(evaluation.reason);
  process.exitCode = 1;
  process.exit();
}

const serialized = `${JSON.stringify(next, null, 2)}\n`;
if (dryRun) {
  process.stdout.write(serialized);
} else {
  writeFileSync(pinPath, serialized, { encoding: "utf8" });
  process.stdout.write(
    `Updated ${pinPath} for ${platform} (productionAuthorized remains false).\n`,
  );
}
