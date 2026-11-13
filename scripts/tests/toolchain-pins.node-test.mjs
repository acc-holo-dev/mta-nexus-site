import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DOCKER_NODE_MAJOR_IMAGE,
  evaluateToolchainPolicy,
  nodeMajorFromEngines,
  readExactNodePin,
  readPinnedPnpm,
} from "../toolchain-policy.mjs";
import {
  DOCKERFILE_NODE_STAGES,
  evaluateDockerfileNodePolicy,
  evaluateInfraImagePins,
  evaluatePostgresLayout,
  INFRA_IMAGE_REFS,
  POSTGRES_MAJOR,
  POSTGRES_VOLUME_PATH,
  readInfraImagePins,
} from "../infra-image-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dbPackage = JSON.parse(readFileSync(join(root, "packages/db/package.json"), "utf8"));
const dockerfile = readFileSync(join(root, "deploy", "Dockerfile"), "utf8");
const composeProduction = readFileSync(join(root, "deploy", "compose.production.yaml"), "utf8");
const composeDev = readFileSync(join(root, "deploy", "compose.yaml"), "utf8");
const composeVerify = readFileSync(join(root, "deploy", "compose.verify.yaml"), "utf8");
const dependabot = readFileSync(join(root, ".github/dependabot.yml"), "utf8");
const pnpmStore = join(root, "node_modules/.pnpm");

function pnpmPackageDir(prefix) {
  const matches = readdirSync(pnpmStore).filter((name) => name.startsWith(prefix));
  assert.ok(matches.length > 0, `Missing pnpm store entry for ${prefix}`);
  return join(pnpmStore, matches.sort().at(-1), "node_modules");
}

function readPkg(...parts) {
  return JSON.parse(readFileSync(join(...parts), "utf8"));
}

test("host/CI Node exact pin agrees and engines describe major-ok Node 26", () => {
  const nodePin = readExactNodePin(root);
  assert.equal(nodePin.ok, true);
  assert.equal(nodePin.pin, "26.11.1");
  assert.equal(nodeMajorFromEngines(rootPackage.engines.node), 26);
  assert.match(rootPackage.engines.node, />=\s*26\.0\.0/u);
  assert.match(rootPackage.engines.node, /<\s*27/u);
  assert.equal(readPinnedPnpm(rootPackage), "12.4.2");
  assert.equal(rootPackage.packageManager, "pnpm@12.4.2");
  assert.match(dockerfile, new RegExp(`FROM ${DOCKER_NODE_MAJOR_IMAGE} AS`, "u"));

  const releaseOk = evaluateToolchainPolicy({
    actualNode: nodePin.pin,
    actualPnpm: "12.4.2",
    enginesNode: rootPackage.engines.node,
    exactNodePin: nodePin.pin,
    exactPnpmPin: "12.4.2",
    mode: "release",
  });
  assert.equal(releaseOk.ok, true);
  assert.equal(releaseOk.majorOk, true);
  assert.equal(releaseOk.nodeExactMatch, true);

  const majorOnlyLocal = evaluateToolchainPolicy({
    actualNode: "26.6.1",
    actualPnpm: "12.4.2",
    enginesNode: rootPackage.engines.node,
    exactNodePin: nodePin.pin,
    exactPnpmPin: "12.4.2",
    mode: "local",
  });
  assert.equal(majorOnlyLocal.ok, true);
  assert.equal(majorOnlyLocal.nodeStatus, "warn");

  const majorOnlyRelease = evaluateToolchainPolicy({
    actualNode: "26.6.1",
    actualPnpm: "12.4.2",
    enginesNode: rootPackage.engines.node,
    exactNodePin: nodePin.pin,
    exactPnpmPin: "12.4.2",
    mode: "release",
  });
  assert.equal(majorOnlyRelease.ok, false);
  assert.equal(majorOnlyRelease.nodeStatus, "fail");
});

test("OPS-03 Node stages, PG18 volume, Dependabot docker updates, and pin schema", () => {
  const nodeStages = evaluateDockerfileNodePolicy(dockerfile);
  assert.equal(nodeStages.ok, true);
  assert.deepEqual(
    nodeStages.stages.map((entry) => entry.stage),
    [...DOCKERFILE_NODE_STAGES],
  );
  for (const entry of nodeStages.stages) {
    assert.match(
      entry.image,
      new RegExp(`^${DOCKER_NODE_MAJOR_IMAGE}(?:@sha256:[a-f0-9]{64})?$`, "u"),
    );
  }

  for (const [label, source] of [
    ["deploy/compose.yaml", composeDev],
    ["deploy/compose.production.yaml", composeProduction],
    ["deploy/compose.verify.yaml", composeVerify],
  ]) {
    assert.match(source, /image:\s*postgres:18-alpine/u, label);
    assert.match(source, /pgdata:\/var\/lib\/postgresql\b/u, label);
    const pg = evaluatePostgresLayout({
      image: INFRA_IMAGE_REFS.postgres,
      volumePath: POSTGRES_VOLUME_PATH,
    });
    assert.equal(pg.ok, true, label);
    assert.equal(pg.major, POSTGRES_MAJOR);
  }
  assert.match(composeProduction, /image:\s*caddy:2-alpine/u);
  assert.match(composeProduction, /image:\s*clamav\/clamav:1\.5/u);
  assert.match(dependabot, /package-ecosystem:\s*"docker"/u);

  const pins = readInfraImagePins(root);
  const evaluation = evaluateInfraImagePins(pins, { requireResolved: false });
  assert.equal(evaluation.ok, true);
  assert.equal(pins.productionAuthorized, false);
  assert.equal(pins.postgresMajor, 18);
  assert.equal(pins.postgresVolumePath, POSTGRES_VOLUME_PATH);
  const allResolved = pins.images.every((entry) => entry.status === "resolved");
  for (const entry of pins.images) {
    assert.equal(entry.ref, INFRA_IMAGE_REFS[entry.role]);
    assert.ok(entry.status === "resolved" || entry.status === "unresolved");
    if (entry.status === "resolved") {
      assert.match(entry.digest, /^sha256:[a-f0-9]{64}$/u);
      assert.match(String(entry.platform), /\//u);
    } else {
      assert.equal(entry.digest, null);
      assert.equal(entry.platform, null);
    }
  }
  assert.equal(evaluateInfraImagePins(pins, { requireResolved: true }).ok, allResolved);

  const unresolvedFixture = {
    ...pins,
    images: pins.images.map((entry) => ({
      ...entry,
      digest: null,
      platform: null,
      status: "unresolved",
    })),
  };
  assert.equal(evaluateInfraImagePins(unresolvedFixture, { requireResolved: false }).ok, true);
  assert.equal(evaluateInfraImagePins(unresolvedFixture, { requireResolved: true }).ok, false);

  assert.equal(evaluateInfraImagePins({ ...pins, schemaVersion: 99 }).ok, false);
  assert.equal(evaluateInfraImagePins({ ...pins, productionAuthorized: true }).ok, false);
  assert.equal(
    evaluatePostgresLayout({ image: "postgres:17-alpine", volumePath: POSTGRES_VOLUME_PATH }).ok,
    false,
  );
});

test("Vite stays on the justified 8.3.5 override for the Vitest 5 unit toolchain", () => {
  assert.match(workspace, /^[ \t]*"vite":\s*"8\.3\.5"\s*$/mu);
  assert.equal(readPkg(pnpmPackageDir("vite@8.3.5"), "vite/package.json").version, "8.3.5");
});

test("dependency-cruiser keeps a TypeScript 6 package extension until stable TS 7 support", () => {
  // Removal gate (do not apply until ALL are true on tip):
  // 1) dependency-cruiser stable ≥18.8 published (18.8.0-beta-1 only as of 2026-10-31)
  // 2) root typescript resolved to ≥7.1 (public compiler API; 7.0.x is insufficient)
  // 3) drop packageExtensions entry for dependency-cruiser
  // 4) update this pin test + pnpm-workspace.yaml
  // 5) pnpm install --frozen-lockfile && pnpm analyze:architecture && pnpm test:tooling
  assert.equal(rootPackage.devDependencies["dependency-cruiser"], "18.7.2");
  assert.match(workspace, /"dependency-cruiser@18\.7\.2":[\s\S]*?typescript:\s*"6\.0\.3"/u);
  const cruiserDir = pnpmPackageDir("dependency-cruiser@18.7.2");
  assert.equal(readPkg(cruiserDir, "dependency-cruiser/package.json").version, "18.7.2");
  assert.equal(readPkg(cruiserDir, "typescript/package.json").version, "6.0.3");
  assert.match(rootPackage.devDependencies.typescript, /^\^7\./u);
  assert.doesNotMatch(
    rootPackage.devDependencies["dependency-cruiser"],
    /beta/iu,
    "do not pin dependency-cruiser betas on main",
  );
});

test("drizzle-kit still owns the @esbuild-kit path with a pinned nested esbuild", () => {
  assert.match(dbPackage.devDependencies["drizzle-kit"], /\^0\.31\.11/u);
  assert.match(workspace, /@esbuild-kit\/core-utils>esbuild":\s*"0\.28\.2"/u);
  const loaderDir = join(pnpmPackageDir("@esbuild-kit+esm-loader@"), "@esbuild-kit/esm-loader");
  const coreModules = pnpmPackageDir("@esbuild-kit+core-utils@");
  const coreDir = join(coreModules, "@esbuild-kit/core-utils");
  assert.equal(readPkg(loaderDir, "package.json").name, "@esbuild-kit/esm-loader");
  assert.equal(readPkg(coreDir, "package.json").name, "@esbuild-kit/core-utils");
  const nestedEsbuild = join(coreDir, "node_modules/esbuild/package.json");
  const siblingEsbuild = join(coreModules, "esbuild/package.json");
  const esbuildPkg = existsSync(nestedEsbuild) ? readPkg(nestedEsbuild) : readPkg(siblingEsbuild);
  assert.equal(esbuildPkg.version, "0.28.2");
});
