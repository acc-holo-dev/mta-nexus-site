import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createECDH, timingSafeEqual } from "node:crypto";
import { test } from "node:test";

import {
  DEFAULT_WEB_PUSH_VAPID_SUBJECT,
  formatWebPushVapidEnvLines,
  generateWebPushVapidEnvLines,
  generateWebPushVapidKeyPair,
} from "../generate-web-push-vapid.mjs";

function decodeBase64Url(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/gu, "+").replace(/_/gu, "/");
  return Buffer.from(base64, "base64");
}

function assertMatchingP256Pair(publicKey, privateKey) {
  const decodedPublic = decodeBase64Url(publicKey);
  const decodedPrivate = decodeBase64Url(privateKey);
  assert.equal(decodedPublic.length, 65);
  assert.equal(decodedPublic[0], 0x04);
  assert.equal(decodedPrivate.length, 32);

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(decodedPrivate);
  const derived = ecdh.getPublicKey(undefined, "uncompressed");
  assert.equal(derived.length, decodedPublic.length);
  assert.ok(timingSafeEqual(derived, decodedPublic));
}

function parseEnvLines(text) {
  const env = {};
  for (const line of text.trim().split("\n")) {
    const index = line.indexOf("=");
    assert.ok(index > 0, line);
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

test("generateWebPushVapidKeyPair produces a matching uncompressed P-256 pair", () => {
  const pair = generateWebPushVapidKeyPair();
  assertMatchingP256Pair(pair.publicKey, pair.privateKey);
});

test("formatWebPushVapidEnvLines keeps supplied keys and subject", () => {
  const lines = formatWebPushVapidEnvLines({
    publicKey: "pub",
    privateKey: "priv",
    subject: "mailto:ops@nexus.example.com",
  });
  assert.deepEqual(lines, [
    "WEB_PUSH_VAPID_PUBLIC_KEY=pub",
    "WEB_PUSH_VAPID_PRIVATE_KEY=priv",
    "WEB_PUSH_VAPID_SUBJECT=mailto:ops@nexus.example.com",
  ]);
});

test("CLI prints env lines accepted by @nexus/config", () => {
  const result = spawnSync(process.execPath, ["scripts/generate-web-push-vapid.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const env = parseEnvLines(result.stdout);
  assert.equal(env.WEB_PUSH_VAPID_SUBJECT, DEFAULT_WEB_PUSH_VAPID_SUBJECT);

  const configCheck = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `import { readWebPushVapidConfig } from "@nexus/config";
const env = ${JSON.stringify(env)};
const config = readWebPushVapidConfig(env);
if (!config) throw new Error("expected VAPID config");
process.stdout.write("ok");`,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(configCheck.status, 0, configCheck.stderr || configCheck.stdout);
  assert.equal(configCheck.stdout.trim(), "ok");
});

test("CLI accepts an explicit subject argument", () => {
  const subject = "https://push.nexus.example.com";
  const result = spawnSync(process.execPath, ["scripts/generate-web-push-vapid.mjs", subject], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const env = parseEnvLines(result.stdout);
  assert.equal(env.WEB_PUSH_VAPID_SUBJECT, subject);
});

test("generateWebPushVapidEnvLines returns three assignable lines", () => {
  const lines = generateWebPushVapidEnvLines("mailto:ops@nexus.example.com");
  assert.equal(lines.length, 3);
  const env = parseEnvLines(lines.join("\n"));
  assertMatchingP256Pair(env.WEB_PUSH_VAPID_PUBLIC_KEY, env.WEB_PUSH_VAPID_PRIVATE_KEY);
  assert.equal(env.WEB_PUSH_VAPID_SUBJECT, "mailto:ops@nexus.example.com");
});
