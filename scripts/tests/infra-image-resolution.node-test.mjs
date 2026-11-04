import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateInfraImagePins, isImagePlatform } from "../infra-image-policy.mjs";

const digest = (char) => `sha256:${char.repeat(64)}`;
const descriptor = (architecture, variant, char) => ({
  digest: digest(char),
  platform: { os: "linux", architecture, ...(variant ? { variant } : {}) },
});

function run(t, manifests, platform) {
  const directory = mkdtempSync(join(tmpdir(), "nexus-infra-pins-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const docker = join(directory, "docker");
  const log = join(directory, "calls");
  writeFileSync(
    docker,
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$OCI_TEST_LOG"\nprintf "%s" "$OCI_TEST_INDEX"\n',
  );
  chmodSync(docker, 0o755);
  const args = ["scripts/resolve-infra-image-digests.mjs", "--dry-run"];
  if (platform !== undefined) args.push("--platform", platform);
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      OCI_TEST_LOG: log,
      OCI_TEST_INDEX: JSON.stringify({ manifests }),
    },
  });
  return { result, log };
}

test("default platform resolves the unique matching digest and preserves current pin policy", (t) => {
  const current = JSON.parse(readFileSync("deploy/infra-image-pins.json", "utf8"));
  assert.equal(evaluateInfraImagePins(current).ok, true);
  const { result } = run(t, [descriptor("amd64", undefined, "a"), descriptor("arm64", "v8", "b")]);
  assert.equal(result.status, 0, result.stderr);
  const pins = JSON.parse(result.stdout);
  assert.equal(evaluateInfraImagePins(pins, { requireResolved: true }).ok, true);
  assert(
    pins.images.every((entry) => entry.platform === "linux/amd64" && entry.digest === digest("a")),
  );
  pins.images[0].platform = "linux/arm/v7/extra";
  assert.equal(evaluateInfraImagePins(pins, { requireResolved: true }).ok, false);
});

test("selects an explicitly requested variant and rejects a missing or wrong variant", (t) => {
  const variants = [descriptor("arm", "v6", "a"), descriptor("arm", "v7", "b")];
  const selected = run(t, variants, "linux/arm/v7").result;
  assert.equal(selected.status, 0, selected.stderr);
  assert(JSON.parse(selected.stdout).images.every((entry) => entry.digest === digest("b")));
  const wrong = run(t, variants, "linux/arm/v8").result;
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /No linux\/arm\/v8 digest/u);
  const missing = run(t, [descriptor("arm", undefined, "a")], "linux/arm/v7").result;
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No linux\/arm\/v7 digest/u);
});

test("rejects ambiguous descriptors when variant is omitted or duplicated", (t) => {
  for (const [entries, platform] of [
    [[descriptor("arm", "v6", "a"), descriptor("arm", "v7", "b")], "linux/arm"],
    [[descriptor("arm", "v7", "a"), descriptor("arm", "v7", "b")], "linux/arm/v7"],
  ]) {
    const { result } = run(t, entries, platform);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Ambiguous or invalid/u);
  }
});

test("rejects a matching descriptor with an invalid digest", (t) => {
  const { result } = run(t, [{ ...descriptor("amd64", undefined, "a"), digest: "sha256:bad" }]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Ambiguous or invalid/u);
});

test("rejects invalid platform strings before invoking Docker", (t) => {
  for (const platform of ["linux/arm/v7/extra", "linux/", "/amd64", "linux/arm v7"]) {
    assert.equal(isImagePlatform(platform), false);
    const { result, log } = run(t, [], platform);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Platform must/u);
    assert.throws(() => readFileSync(log));
  }
});
