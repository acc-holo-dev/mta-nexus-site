import { Buffer } from "node:buffer";
import { getEnvConfig, readMtaMasterMirrorUrls, readWebPushVapidConfig } from "@nexus/config";
import { describe, expect, it } from "vitest";
import { configProductionBase, createConfigVapidKeyPair } from "./helpers/config-harness";

describe("Web Push VAPID configuration", () => {
  const pair = createConfigVapidKeyPair();
  const valid = {
    WEB_PUSH_VAPID_PUBLIC_KEY: pair.publicKey,
    WEB_PUSH_VAPID_PRIVATE_KEY: pair.privateKey,
    WEB_PUSH_VAPID_SUBJECT: "mailto:ops@nexus.example.com",
  };

  it("accepts a complete VAPID triplet", () => {
    expect(readWebPushVapidConfig(valid)).toEqual({
      publicKey: valid.WEB_PUSH_VAPID_PUBLIC_KEY,
      privateKey: valid.WEB_PUSH_VAPID_PRIVATE_KEY,
      subject: valid.WEB_PUSH_VAPID_SUBJECT,
    });
  });

  it("treats an entirely absent VAPID configuration as disabled", () => {
    expect(readWebPushVapidConfig({})).toBeNull();
  });

  it("rejects a public key that does not match the private key", () => {
    const otherPair = createConfigVapidKeyPair();
    expect(() =>
      readWebPushVapidConfig({
        ...valid,
        WEB_PUSH_VAPID_PUBLIC_KEY: otherPair.publicKey,
      }),
    ).toThrow("Invalid Web Push VAPID configuration");
  });

  it("rejects partial and malformed VAPID configuration", () => {
    expect(() =>
      readWebPushVapidConfig({
        WEB_PUSH_VAPID_PUBLIC_KEY: valid.WEB_PUSH_VAPID_PUBLIC_KEY,
      }),
    ).toThrow("Invalid Web Push VAPID configuration");

    expect(() =>
      readWebPushVapidConfig({
        ...valid,
        WEB_PUSH_VAPID_PRIVATE_KEY: Buffer.from(new Uint8Array(32)).toString("base64url"),
      }),
    ).toThrow("Invalid Web Push VAPID configuration");

    expect(() =>
      readWebPushVapidConfig({
        ...valid,
        WEB_PUSH_VAPID_SUBJECT: "http://nexus.example.com",
      }),
    ).toThrow("Invalid Web Push VAPID configuration");
  });

  it("makes the production schema reject partial VAPID configuration", () => {
    expect(() =>
      getEnvConfig({
        ...configProductionBase,
        NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
        WEB_PUSH_VAPID_PUBLIC_KEY: valid.WEB_PUSH_VAPID_PUBLIC_KEY,
      }),
    ).toThrow("Invalid configuration parameters");
  });
});

describe("MTA master mirror configuration", () => {
  it("accepts up to three distinct public HTTPS endpoints", () => {
    expect(
      readMtaMasterMirrorUrls({
        MTA_MASTER_MIRROR_URLS:
          "https://mirror-one.example.com/ase/mta/, https://mirror-two.example.net/master",
      }),
    ).toEqual(["https://mirror-one.example.com/ase/mta/", "https://mirror-two.example.net/master"]);
  });

  it.each([
    "http://mirror.example.com/ase/mta/",
    "https://user:pass@mirror.example.com/ase/mta/",
    "https://127.0.0.1/ase/mta/",
    "https://[::1]/ase/mta/",
    "https://localhost/ase/mta/",
    "https://intranet/ase/mta/",
    "https://master.local/ase/mta/",
    "https://mirror.example.com:8443/ase/mta/",
    "https://mirror.example.com/ase/mta/#fragment",
  ])("rejects unsafe mirror endpoint %s", (endpoint) => {
    expect(() =>
      readMtaMasterMirrorUrls({
        MTA_MASTER_MIRROR_URLS: endpoint,
      }),
    ).toThrow();
  });

  it("rejects duplicates and more than three mirrors", () => {
    expect(() =>
      readMtaMasterMirrorUrls({
        MTA_MASTER_MIRROR_URLS: "https://one.example.com/x, https://one.example.com/x",
      }),
    ).toThrow("unique");

    expect(() =>
      readMtaMasterMirrorUrls({
        MTA_MASTER_MIRROR_URLS: [
          "https://one.example.com/x",
          "https://two.example.com/x",
          "https://three.example.com/x",
          "https://four.example.com/x",
        ].join(","),
      }),
    ).toThrow("three");
  });

  it("makes the production schema reject invalid mirror configuration", () => {
    expect(() =>
      getEnvConfig({
        ...configProductionBase,
        NEXT_PUBLIC_APP_URL: "https://nexus-mta.com",
        MTA_MASTER_MIRROR_URLS: "http://127.0.0.1/master",
      }),
    ).toThrow("Invalid configuration parameters");
  });
});
