import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Toolchain policy (OPS-02 / ARC04–ARC05):
 * - `engines.node` = supported major branch (major-ok for local host tooling).
 * - `.nvmrc` + `.node-version` = exact host/CI release pin (must agree).
 * - `packageManager` = exact pnpm pin.
 * - Docker `node:26-alpine` tracks the major branch, not the exact host patch.
 */

export const DOCKER_NODE_MAJOR_IMAGE = "node:26-alpine";

export function parseSemver(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/u);
  if (!match) return null;
  return Object.freeze({
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    text: `${match[1]}.${match[2] ?? 0}.${match[3] ?? 0}`,
  });
}

/** Accepts `>=26.0.0`, `>=26.0.0 <27`, `^26.0.0`, or an exact `26.11.1`. */
export function nodeMajorFromEngines(enginesNode) {
  const raw = String(enginesNode ?? "").trim();
  if (!raw) return null;
  const caret = raw.match(/^\^(\d+)/u);
  if (caret) return Number(caret[1]);
  const lower = raw.match(/>=\s*v?(\d+)/u);
  if (lower) return Number(lower[1]);
  const exact = parseSemver(raw);
  return exact?.major ?? null;
}

export function readExactNodePin(root) {
  const nvmrc = readFileSync(join(root, ".nvmrc"), "utf8").trim();
  const nodeVersion = readFileSync(join(root, ".node-version"), "utf8").trim();
  if (!nvmrc || nvmrc !== nodeVersion || !parseSemver(nvmrc)) {
    return {
      ok: false,
      pin: null,
      nvmrc,
      nodeVersion,
      reason: "Repository Node version files are missing, invalid, or disagree.",
    };
  }
  return { ok: true, pin: nvmrc, nvmrc, nodeVersion, reason: null };
}

export function readPinnedPnpm(packageJson) {
  const raw = String(packageJson?.packageManager ?? "");
  const match = raw.match(/^pnpm@(\d+\.\d+\.\d+)$/u);
  return match ? match[1] : null;
}

/**
 * @param {"local" | "release"} mode
 * local: major mismatch fails; exact pin mismatch warns.
 * release: major or exact mismatch fails (candidate must record the approved runtime).
 */
export function evaluateToolchainPolicy({
  actualNode,
  actualPnpm,
  enginesNode,
  exactNodePin,
  exactPnpmPin,
  mode = "local",
}) {
  const actual = parseSemver(actualNode);
  const pin = parseSemver(exactNodePin);
  const requiredMajor = nodeMajorFromEngines(enginesNode);
  const majorOk = actual !== null && requiredMajor !== null && actual.major === requiredMajor;
  const nodeExactMatch = actual !== null && pin !== null && actual.text === pin.text;
  const pnpmExactMatch = Boolean(
    exactPnpmPin && actualPnpm && String(actualPnpm) === String(exactPnpmPin),
  );

  const release = mode === "release";
  const nodeStatus = !majorOk ? "fail" : nodeExactMatch ? "pass" : release ? "fail" : "warn";
  const pnpmStatus = pnpmExactMatch ? "pass" : release ? "fail" : "warn";

  return Object.freeze({
    mode,
    enginesNode: enginesNode ?? null,
    requiredMajor,
    exactNodePin: exactNodePin ?? null,
    exactPnpmPin: exactPnpmPin ?? null,
    actualNode: actual?.text ?? null,
    actualPnpm: actualPnpm ?? null,
    dockerNodeImage: DOCKER_NODE_MAJOR_IMAGE,
    majorOk,
    nodeExactMatch,
    pnpmExactMatch,
    nodeStatus,
    pnpmStatus,
    ok: nodeStatus !== "fail" && pnpmStatus !== "fail",
  });
}

export function collectRepositoryToolchain(root, packageJson) {
  const nodePin = readExactNodePin(root);
  const pnpmPin = readPinnedPnpm(packageJson);
  return Object.freeze({
    nodePin,
    pnpmPin,
    enginesNode: packageJson?.engines?.node ?? null,
    enginesPnpm: packageJson?.engines?.pnpm ?? null,
    packageManager: packageJson?.packageManager ?? null,
    dockerNodeImage: DOCKER_NODE_MAJOR_IMAGE,
  });
}
