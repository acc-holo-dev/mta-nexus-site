#!/usr/bin/env node
/**
 * OPS-03 helper: resolve selected base/infra image digests for a release candidate.
 * Writes deploy/infra-image-pins.json with status=resolved. Does not push images,
 * change Compose tags, or set productionAuthorized.
 *
 * Usage:
 *   node scripts/resolve-infra-image-digests.mjs [--platform linux/amd64] [--dry-run]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateInfraImagePins,
  INFRA_IMAGE_REFS,
  isImageDigest,
} from "./infra-image-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pinPath = join(root, "deploy/infra-image-pins.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const platformIndex = args.indexOf("--platform");
const platform =
  platformIndex >= 0 && args[platformIndex + 1] ? args[platformIndex + 1] : "linux/amd64";
const [osName, arch] = platform.split("/");

function resolveDigest(ref) {
  const result = spawnSync(
    "docker",
    [
      "buildx",
      "imagetools",
      "inspect",
      ref,
      "--format",
      "{{range .Manifest.Manifests}}{{if and (eq .Platform.OS \"" +
        osName +
        "\") (eq .Platform.Architecture \"" +
        arch +
        "\")}}{{.Digest}}{{println}}{{end}}{{end}}",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`imagetools inspect failed for ${ref}: ${result.stderr || result.stdout}`);
  }
  const digest = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => isImageDigest(line));
  if (!digest) {
    throw new Error(`No ${platform} digest found for ${ref}`);
  }
  return digest;
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
  process.stdout.write(`Updated ${pinPath} for ${platform} (productionAuthorized remains false).\n`);
}
