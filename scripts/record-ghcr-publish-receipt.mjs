#!/usr/bin/env node
/**
 * OPS-10: write a local GHCR publish receipt. Never sets productionAuthorized.
 * Expects env: GHCR_IMAGE, GHCR_DIGEST, GITHUB_SHA, optional GHCR_PLATFORM.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const digest = process.env.GHCR_DIGEST ?? "";
const image = process.env.GHCR_IMAGE ?? "";
const sourceSha = process.env.GITHUB_SHA ?? "";
const platform = process.env.GHCR_PLATFORM ?? "linux/amd64";

if (!/^sha256:[a-f0-9]{64}$/u.test(digest)) {
  console.error("GHCR_DIGEST must be a sha256 digest.");
  process.exitCode = 1;
  process.exit();
}
if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(sourceSha)) {
  console.error("GITHUB_SHA must be the exact commit published.");
  process.exitCode = 1;
  process.exit();
}

const report = {
  schemaVersion: 1,
  kind: "ghcr_publish_receipt",
  productionAuthorized: false,
  image,
  digest,
  platform,
  sourceSha,
  rebuilt: false,
  note: "Published previously verified CI bytes; mutable tags are not deploy inputs.",
};

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  join("artifacts", "ghcr-publish-receipt.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`Wrote artifacts/ghcr-publish-receipt.json digest=${digest}\n`);
