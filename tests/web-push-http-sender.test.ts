import { createECDH } from "node:crypto";
import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import type { WebPushVapidConfig } from "@nexus/config";
import {
  createWebPushHttpSender,
  prepareWebPushRequest,
} from "../apps/web/src/lib/services/web-push-http-sender";

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

function subscription() {
  const receiver = createECDH("prime256v1");
  receiver.generateKeys();
  return {
    endpoint: "https://push.example.net/subscriptions/abc?token=1",
    p256dh: receiver
      .getPublicKey(undefined, "uncompressed")
      .toString("base64url"),
    auth: Buffer.alloc(16, 7).toString("base64url"),
  };
}

describe("Web Push HTTP sender", () => {
  it("builds the mandatory RFC push headers", () => {
    const config = vapidConfig();
    const prepared = prepareWebPushRequest(
      "https://push.example.net/subscriptions/abc",
      subscription(),
      {
        title: "Security notice",
        body: "Review your account sessions.",
        url: "/security",
      },
      config,
      {
        ttlSeconds: 30,
        nowSeconds: 1_800_000_000,
      },
    );

    expect(prepared.headers.TTL).toBe("30");
    expect(prepared.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(prepared.headers["Content-Type"]).toBe(
      "application/octet-stream",
    );
    expect(prepared.headers["Content-Length"]).toBe(
      String(prepared.body.length),
    );
    expect(prepared.headers.Authorization).toMatch(
      new RegExp(`^vapid t=[^.]+\\.[^.]+\\.[^,]+, k=${config.publicKey}$`, "u"),
    );
    expect(prepared.body.length).toBeGreaterThan(86);
  });

  it("connects to the pinned public IP while preserving Host and TLS SNI", async () => {
    const transport = vi.fn(async () => ({ statusCode: 201 }));
    const sender = createWebPushHttpSender(vapidConfig(), {
      resolver: async () => [{ address: "1.1.1.1", family: 4 }],
      transport,
      timeoutMs: 5_000,
      ttlSeconds: 60,
      nowSeconds: () => 1_800_000_000,
    });
    const current = subscription();

    await expect(
      sender(current, {
        title: "MTA NEXUS",
        body: "New notification",
        url: "/notifications",
      }),
    ).resolves.toEqual({ statusCode: 201 });

    expect(transport).toHaveBeenCalledTimes(1);
    const request = transport.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      connectAddress: "1.1.1.1",
      family: 4,
      servername: "push.example.net",
      port: 443,
      path: "/subscriptions/abc?token=1",
      timeoutMs: 5_000,
    });
    expect(request?.headers.Host).toBe("push.example.net");
    expect(request?.headers.TTL).toBe("60");
  });

  it("never reaches transport for a private DNS resolution", async () => {
    const transport = vi.fn(async () => ({ statusCode: 201 }));
    const sender = createWebPushHttpSender(vapidConfig(), {
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      transport,
    });

    await expect(
      sender(subscription(), {
        title: "MTA NEXUS",
        body: "New notification",
      }),
    ).rejects.toThrow("exclusively to public addresses");
    expect(transport).not.toHaveBeenCalled();
  });
});
