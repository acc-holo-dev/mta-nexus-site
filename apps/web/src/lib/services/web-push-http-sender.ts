import { Buffer } from "node:buffer";
import { request as httpsRequest } from "node:https";
import type { WebPushVapidConfig } from "@nexus/config";
import type {
  WebPushNotificationPayload,
  WebPushSender,
  WebPushSendResult,
} from "./web-push-delivery-service";
import {
  createVapidAuthorization,
  encryptWebPushMessage,
} from "./web-push-crypto";
import {
  resolveWebPushTarget,
  systemWebPushHostResolver,
  type WebPushHostResolver,
} from "./web-push-endpoint-policy";

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_TIMEOUT_MS = 10_000;

export type PreparedWebPushRequest = {
  body: Buffer;
  headers: Record<string, string>;
  url: URL;
};

export type WebPushHttpsRequest = {
  body: Buffer;
  connectAddress: string;
  family: 4 | 6;
  headers: Record<string, string>;
  path: string;
  port: number;
  servername: string;
  timeoutMs: number;
};

export type WebPushHttpsTransport = (
  request: WebPushHttpsRequest,
) => Promise<WebPushSendResult>;

export function prepareWebPushRequest(
  endpoint: string,
  subscription: {
    p256dh: string;
    auth: string;
  },
  payload: WebPushNotificationPayload,
  config: WebPushVapidConfig,
  options: {
    ttlSeconds?: number;
    nowSeconds?: number;
  } = {},
): PreparedWebPushRequest {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 0 ||
    ttlSeconds > 2_147_483_648
  ) {
    throw new RangeError("Invalid Web Push TTL");
  }

  const url = new URL(endpoint);
  const body = encryptWebPushMessage(
    subscription,
    Buffer.from(JSON.stringify(payload), "utf8"),
  );
  const authorization = createVapidAuthorization(
    endpoint,
    config,
    options.nowSeconds,
  );

  return {
    body,
    url,
    headers: {
      Authorization: authorization.header,
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
    },
  };
}

export const sendWebPushHttpsRequest: WebPushHttpsTransport = async (
  prepared,
) =>
  await new Promise<WebPushSendResult>((resolve, reject) => {
    const request = httpsRequest(
      {
        protocol: "https:",
        hostname: prepared.connectAddress,
        family: prepared.family,
        port: prepared.port,
        servername: prepared.servername,
        path: prepared.path,
        method: "POST",
        headers: prepared.headers,
        rejectUnauthorized: true,
        signal: AbortSignal.timeout(prepared.timeoutMs),
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        response.destroy();
        resolve({ statusCode });
      },
    );

    request.once("error", reject);
    request.end(prepared.body);
  });

export function createWebPushHttpSender(
  config: WebPushVapidConfig,
  options: {
    resolver?: WebPushHostResolver;
    transport?: WebPushHttpsTransport;
    timeoutMs?: number;
    ttlSeconds?: number;
    nowSeconds?: () => number;
  } = {},
): WebPushSender {
  const resolver = options.resolver ?? systemWebPushHostResolver;
  const transport = options.transport ?? sendWebPushHttpsRequest;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 250 ||
    timeoutMs > 60_000
  ) {
    throw new RangeError("Invalid Web Push timeout");
  }

  return async (subscription, payload) => {
    const target = await resolveWebPushTarget(
      subscription.endpoint,
      resolver,
    );
    const prepared = prepareWebPushRequest(
      target.url.toString(),
      subscription,
      payload,
      config,
      {
        ttlSeconds: options.ttlSeconds,
        nowSeconds: options.nowSeconds?.(),
      },
    );

    return await transport({
      body: prepared.body,
      connectAddress: target.address,
      family: target.family,
      headers: {
        ...prepared.headers,
        Host: target.url.host,
      },
      path: `${target.url.pathname}${target.url.search}`,
      port: 443,
      servername: target.hostname,
      timeoutMs,
    });
  };
}
