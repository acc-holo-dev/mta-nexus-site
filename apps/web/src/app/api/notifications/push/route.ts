import { createHash } from "node:crypto";
import { readWebPushVapidConfig } from "@nexus/config";
import { webPushSubscriptionRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { consumeRateLimit, generateId } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { parseWebPushEndpoint } from "../../../../lib/services/web-push-endpoint-policy";
import { parseWebPushSubscription } from "../../../../lib/web-push-subscription";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

function publicKey() {
  try {
    return readWebPushVapidConfig()?.publicKey ?? null;
  } catch {
    return null;
  }
}

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  return authService.getSessionIdentity(token);
}

function checkExpectedIdentity(
  value: unknown,
  authenticated: NonNullable<Awaited<ReturnType<typeof requireSession>>>,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "invalid";
  const body = value as Record<string, unknown>;
  const valid = (id: unknown) =>
    typeof id === "string" && id.length > 0 && id.length <= 128 && id.trim() === id;
  if (!valid(body.expectedActorId) || !valid(body.expectedSessionId)) return "invalid";
  if (
    body.expectedActorId !== authenticated.user.id ||
    body.expectedSessionId !== authenticated.sessionId
  )
    return "changed";
  return "ok";
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const authenticated = await requireSession(request);
    if (!authenticated) {
      return json(context, { error: "Authentication required" }, 401);
    }

    const endpointHash = request.nextUrl.searchParams.get("endpointHash")?.trim() ?? "";
    if (endpointHash && !/^[a-f0-9]{64}$/u.test(endpointHash)) {
      return json(
        context,
        {
          error: "Invalid Web Push endpoint fingerprint",
        },
        400,
      );
    }

    const key = publicKey();
    let subscribed = false;
    if (endpointHash) {
      const active = await webPushSubscriptionRepository.listForSession(
        authenticated.user.id,
        authenticated.sessionId,
      );
      subscribed = active.some(
        (subscription) =>
          createHash("sha256").update(subscription.endpoint, "utf8").digest("hex") === endpointHash,
      );
    }

    return json(context, {
      actorId: authenticated.user.id,
      sessionId: authenticated.sessionId,
      configured: key !== null,
      publicKey: key,
      subscribed,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "notifications.push_state_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: "Failed to read Web Push state",
      },
      500,
    );
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);

  try {
    const authenticated = await requireSession(request);
    if (!authenticated) {
      return json(context, { error: "Authentication required" }, 401);
    }
    if (!publicKey()) {
      return json(context, { error: "Web Push is not configured" }, 503);
    }

    requireServerJsonContentType(request);
    const limit = await consumeRateLimit("notificationMutation", authenticated.user.id);
    if (!limit.success) {
      return json(
        context,
        {
          error: "Too many notification updates. Please try again shortly.",
        },
        429,
      );
    }

    const body = await readBoundedJson(request, 16 * 1024);
    const identity = checkExpectedIdentity(body, authenticated);
    if (identity !== "ok")
      return json(
        context,
        {
          error:
            identity === "changed"
              ? "Account or session changed. Reload settings."
              : "Invalid Web Push identity",
          code: identity === "changed" ? "PUSH_IDENTITY_CHANGED" : "INVALID_PUSH_IDENTITY",
        },
        identity === "changed" ? 409 : 400,
      );
    const parsed = parseWebPushSubscription(body);
    if (!parsed) {
      return json(
        context,
        {
          error: "Invalid Web Push subscription",
        },
        400,
      );
    }

    const stored = await webPushSubscriptionRepository.upsertWithResult({
      id: generateId("wps"),
      userId: authenticated.user.id,
      sessionId: authenticated.sessionId,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      expirationAt: parsed.expirationAt,
      userAgent: request.headers.get("user-agent"),
    });

    if (stored.status !== "stored") {
      const endpointConflict = stored.status === "endpoint_conflict";
      return json(
        context,
        {
          error: endpointConflict
            ? "Web Push endpoint is already bound to another session"
            : "Too many Web Push subscriptions for this session",
          code: endpointConflict ? "WEB_PUSH_ENDPOINT_CONFLICT" : "WEB_PUSH_SESSION_LIMIT",
        },
        409,
      );
    }

    return json(context, {
      success: true,
      actorId: authenticated.user.id,
      sessionId: authenticated.sessionId,
      subscribed: true,
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
      ].includes(error.code)
    ) {
      return json(context, { error: error.message, code: error.code }, error.statusCode);
    }
    logRequestEvent({
      level: "error",
      event: "notifications.push_subscribe_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: "Failed to register Web Push subscription",
      },
      500,
    );
  }
});

export const DELETE = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);

  try {
    const authenticated = await requireSession(request);
    if (!authenticated) {
      return json(context, { error: "Authentication required" }, 401);
    }

    requireServerJsonContentType(request);
    const limit = await consumeRateLimit("notificationMutation", authenticated.user.id);
    if (!limit.success) {
      return json(
        context,
        {
          error: "Too many notification updates. Please try again shortly.",
        },
        429,
      );
    }

    const body = await readBoundedJson(request, 16 * 1024);
    const identity = checkExpectedIdentity(body, authenticated);
    if (identity !== "ok")
      return json(
        context,
        {
          error:
            identity === "changed"
              ? "Account or session changed. Reload settings."
              : "Invalid Web Push identity",
          code: identity === "changed" ? "PUSH_IDENTITY_CHANGED" : "INVALID_PUSH_IDENTITY",
        },
        identity === "changed" ? 409 : 400,
      );
    const endpoint =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as Record<string, unknown>).endpoint === "string"
        ? String((body as Record<string, unknown>).endpoint).trim()
        : "";
    if (!endpoint || endpoint.length > 2048) {
      return json(context, { error: "Invalid Web Push endpoint" }, 400);
    }

    let normalizedEndpoint: string;
    try {
      normalizedEndpoint = parseWebPushEndpoint(endpoint).toString();
    } catch {
      return json(context, { error: "Invalid Web Push endpoint" }, 400);
    }

    const removed = await webPushSubscriptionRepository.removeForSession(
      authenticated.user.id,
      authenticated.sessionId,
      normalizedEndpoint,
    );
    return json(context, {
      success: true,
      actorId: authenticated.user.id,
      sessionId: authenticated.sessionId,
      subscribed: false,
      removed,
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
      ].includes(error.code)
    ) {
      return json(context, { error: error.message, code: error.code }, error.statusCode);
    }
    logRequestEvent({
      level: "error",
      event: "notifications.push_unsubscribe_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: "Failed to remove Web Push subscription",
      },
      500,
    );
  }
});
