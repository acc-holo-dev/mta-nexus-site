import { Buffer } from "node:buffer";
import {
  createECDH,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import type { WebPushVapidConfig } from "@nexus/config";
import {
  createVapidAuthorization,
  encryptWebPushMessage,
} from "../apps/web/src/lib/services/web-push-crypto";

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

describe("RFC 8291 Web Push encryption", () => {
  it("matches the published aes128gcm encryption example exactly", () => {
    const receiverPublic =
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    const auth = "BTBZMqHH6r4Tts7J_aSIgg";
    const senderPrivate =
      "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    const salt = "DGv6ra1nlYgDCS1FRnbzlw";
    const expected =
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    const encrypted = encryptWebPushMessage(
      { p256dh: receiverPublic, auth },
      Buffer.from(
        "When I grow up, I want to be a watermelon",
        "utf8",
      ),
      {
        recordSize: 4096,
        salt: decode(salt),
        senderPrivateKey: decode(senderPrivate),
      },
    );

    expect(encrypted.toString("base64url")).toBe(expected);
  });

  it("rejects a message that cannot fit the mandatory single record", () => {
    const receiver = createECDH("prime256v1");
    receiver.generateKeys();

    expect(() =>
      encryptWebPushMessage(
        {
          p256dh: receiver
            .getPublicKey(undefined, "uncompressed")
            .toString("base64url"),
          auth: Buffer.alloc(16, 7).toString("base64url"),
        },
        Buffer.alloc(100),
        { recordSize: 64 },
      ),
    ).toThrow("does not fit one encrypted record");
  });
});

describe("RFC 8292 VAPID authorization", () => {
  function vapidConfig(): WebPushVapidConfig {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    return {
      publicKey: ecdh
        .getPublicKey(undefined, "uncompressed")
        .toString("base64url"),
      privateKey: ecdh.getPrivateKey().toString("base64url"),
      subject: "mailto:ops@nexus.example.com",
    };
  }

  it("binds the JWT to the push origin and signs it with ES256", () => {
    const config = vapidConfig();
    const now = 1_800_000_000;
    const authorization = createVapidAuthorization(
      "https://push.example.net/p/subscription?token=abc",
      config,
      now,
    );

    expect(authorization.audience).toBe("https://push.example.net");
    expect(authorization.expiresAt).toBe(now + 12 * 60 * 60);
    expect(authorization.header).toBe(
      `vapid t=${authorization.token}, k=${config.publicKey}`,
    );

    const [encodedHeader, encodedClaims, encodedSignature] =
      authorization.token.split(".");
    expect(JSON.parse(decode(encodedHeader).toString("utf8"))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(decode(encodedClaims).toString("utf8"))).toEqual({
      aud: "https://push.example.net",
      exp: now + 12 * 60 * 60,
      sub: config.subject,
    });

    const publicPoint = decode(config.publicKey);
    const verificationKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: publicPoint.subarray(1, 33).toString("base64url"),
        y: publicPoint.subarray(33, 65).toString("base64url"),
      },
      format: "jwk",
    });
    expect(
      verifySignature(
        "sha256",
        Buffer.from(
          `${encodedHeader}.${encodedClaims}`,
          "ascii",
        ),
        {
          key: verificationKey,
          dsaEncoding: "ieee-p1363",
        },
        decode(encodedSignature),
      ),
    ).toBe(true);
  });

  it("rejects an insecure push endpoint before creating credentials", () => {
    expect(() =>
      createVapidAuthorization(
        "http://push.example.net/subscription",
        vapidConfig(),
      ),
    ).toThrow("must use HTTPS");
  });
});
