import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dbPackage = JSON.parse(readFileSync(join(root, "packages/db/package.json"), "utf8"));
const pnpmStore = join(root, "node_modules/.pnpm");

function pnpmPackageDir(prefix) {
  const matches = readdirSync(pnpmStore).filter((name) => name.startsWith(prefix));
  assert.ok(matches.length > 0, `Missing pnpm store entry for ${prefix}`);
  return join(pnpmStore, matches.sort().at(-1), "node_modules");
}

function readPkg(...parts) {
  return JSON.parse(readFileSync(join(...parts), "utf8"));
}

test("Vite stays on the justified 8.3.5 override for the Vitest 5 unit toolchain", () => {
  assert.match(workspace, /^[ \t]*"vite":\s*"8\.3\.5"\s*$/mu);
  assert.equal(readPkg(pnpmPackageDir("vite@8.3.5"), "vite/package.json").version, "8.3.5");
});

test("dependency-cruiser keeps a TypeScript 6 package extension until stable TS 7 support", () => {
  assert.equal(rootPackage.devDependencies["dependency-cruiser"], "18.7.0");
  assert.match(workspace, /"dependency-cruiser@18\.7\.0":[\s\S]*?typescript:\s*"6\.0\.3"/u);
  const cruiserDir = pnpmPackageDir("dependency-cruiser@18.7.0");
  assert.equal(readPkg(cruiserDir, "dependency-cruiser/package.json").version, "18.7.0");
  assert.equal(readPkg(cruiserDir, "typescript/package.json").version, "6.0.3");
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
