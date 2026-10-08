import assert from "node:assert/strict";
import { createECDH } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  createWebPushHttpSender,
  sendWebPushHttpsRequest,
  type WebPushHttpsRequest,
} from "../../packages/db/src/web-push-runtime";

const port = Number(process.env.NEXUS_PUSH_TEST_PORT);
assert(Number.isSafeInteger(port) && port > 0 && port < 65536);

const vapid = createECDH("prime256v1");
vapid.generateKeys();
const config = {
  publicKey: vapid
    .getPublicKey(undefined, "uncompressed")
    .toString("base64url"),
  privateKey: vapid.getPrivateKey().toString("base64url"),
  subject: "mailto:ops@nexus.example.com",
};

const receiver = createECDH("prime256v1");
receiver.generateKeys();
const subscription = {
  endpoint: "https://push.example.net/subscriptions/201",
  p256dh: receiver
    .getPublicKey(undefined, "uncompressed")
    .toString("base64url"),
  auth: Buffer.alloc(16, 7).toString("base64url"),
};

const localTlsTransport = async (
  request: WebPushHttpsRequest,
) =>
  await sendWebPushHttpsRequest({
    ...request,
    connectAddress: "127.0.0.1",
    port,
  });

const sender = createWebPushHttpSender(config, {
  resolver: async (hostname) => {
    assert.equal(hostname, "push.example.net");
    return [{ address: "1.1.1.1", family: 4 }];
  },
  transport: localTlsTransport,
  timeoutMs: 300,
  ttlSeconds: 60,
  nowSeconds: () => 1_800_000_000,
});

const statuses = [];
for (const status of [201, 410, 503]) {
  statuses.push(
    (
      await sender(
        {
          ...subscription,
          endpoint:
            "https://push.example.net/subscriptions/" +
            status,
        },
        {
          title: "MTA NEXUS",
          body: "Closed TLS provider acceptance",
          url: "/notifications",
          tag: "network-acceptance",
        },
      )
    ).statusCode,
  );
}

let timeoutRejected = false;
try {
  await sender(
    {
      ...subscription,
      endpoint:
        "https://push.example.net/subscriptions/hang",
    },
    {
      title: "MTA NEXUS",
      body: "Timeout acceptance",
      url: "/notifications",
    },
  );
} catch {
  timeoutRejected = true;
}

process.stdout.write(
  JSON.stringify({ statuses, timeoutRejected }) + "\n",
);
