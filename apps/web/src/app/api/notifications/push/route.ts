import { createHash } from "node:crypto";
import { readWebPushVapidConfig } from "@nexus/config";
import type { NextRequest } from "next/server";
import { webPushSubscriptionRepository } from "@nexus/db";
import {
  consumeRateLimit,
  generateId,
} from "@nexus/security";
import { parseWebPushSubscription } from "../../../../lib/web-push-subscription";
import { parseWebPushEndpoint } from "../../../../lib/services/web-push-endpoint-policy";
import { authService } from "../../../../lib/services/auth-service";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
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

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const authenticated =
      await requireSession(request);
    if (!authenticated) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const endpointHash =
      request.nextUrl.searchParams
        .get("endpointHash")
        ?.trim() ?? "";
    if (
      endpointHash &&
      !/^[a-f0-9]{64}$/u.test(endpointHash)
    ) {
      return json(
        context,
        {
          error:
            "Invalid Web Push endpoint fingerprint",
        },
        400,
      );
    }

    const key = publicKey();
    let subscribed = false;
    if (endpointHash) {
      const active =
        await webPushSubscriptionRepository.listForSession(
          authenticated.user.id,
          authenticated.sessionId,
        );
      subscribed = active.some(
        (subscription) =>
          createHash("sha256")
            .update(
              subscription.endpoint,
              "utf8",
            )
            .digest("hex") === endpointHash,
      );
    }

    return json(context, {
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
        error:
          "Failed to read Web Push state",
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const authenticated =
      await requireSession(request);
    if (!authenticated) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }
    if (!publicKey()) {
      return json(
        context,
        { error: "Web Push is not configured" },
        503,
      );
    }

    const limit = await consumeRateLimit(
      "notificationMutation",
      authenticated.user.id,
    );
    if (!limit.success) {
      return json(
        context,
        {
          error:
            "Too many notification updates. Please try again shortly.",
        },
        429,
      );
    }

    const parsed = parseWebPushSubscription(
      await request.json().catch(() => null),
    );
    if (!parsed) {
      return json(
        context,
        {
          error:
            "Invalid Web Push subscription",
        },
        400,
      );
    }

    const stored =
      await webPushSubscriptionRepository.upsertWithResult(
        {
          id: generateId("wps"),
          userId: authenticated.user.id,
          sessionId:
            authenticated.sessionId,
          endpoint: parsed.endpoint,
          p256dh: parsed.p256dh,
          auth: parsed.auth,
          expirationAt: parsed.expirationAt,
          userAgent:
            request.headers.get("user-agent"),
        },
      );

    if (stored.status !== "stored") {
      const endpointConflict =
        stored.status === "endpoint_conflict";
      return json(
        context,
        {
          error: endpointConflict
            ? "Web Push endpoint is already bound to another session"
            : "Too many Web Push subscriptions for this session",
          code: endpointConflict
            ? "WEB_PUSH_ENDPOINT_CONFLICT"
            : "WEB_PUSH_SESSION_LIMIT",
        },
        409,
      );
    }

    return json(context, {
      success: true,
      subscribed: true,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event:
        "notifications.push_subscribe_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Failed to register Web Push subscription",
      },
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const authenticated =
      await requireSession(request);
    if (!authenticated) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const limit = await consumeRateLimit(
      "notificationMutation",
      authenticated.user.id,
    );
    if (!limit.success) {
      return json(
        context,
        {
          error:
            "Too many notification updates. Please try again shortly.",
        },
        429,
      );
    }

    const body = await request
      .json()
      .catch(() => null);
    const endpoint =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as Record<string, unknown>)
        .endpoint === "string"
        ? String(
            (body as Record<string, unknown>)
              .endpoint,
          ).trim()
        : "";
    if (!endpoint || endpoint.length > 2048) {
      return json(
        context,
        { error: "Invalid Web Push endpoint" },
        400,
      );
    }

    let normalizedEndpoint: string;
    try {
      normalizedEndpoint =
        parseWebPushEndpoint(endpoint).toString();
    } catch {
      return json(
        context,
        { error: "Invalid Web Push endpoint" },
        400,
      );
    }

    await webPushSubscriptionRepository.removeForSession(
      authenticated.user.id,
      authenticated.sessionId,
      normalizedEndpoint,
    );
    return json(context, {
      success: true,
      subscribed: false,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event:
        "notifications.push_unsubscribe_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Failed to remove Web Push subscription",
      },
      500,
    );
  }
}
