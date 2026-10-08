import { after, type NextRequest } from "next/server";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/observability";
import { authService } from "../../../lib/services/auth-service";
import {
  organizationRepository,
  productRepository,
  serverRepository,
  socialRepository,
  userRepository,
} from "@nexus/db";
import {
  consumeRateLimit,
  generateId,
} from "@nexus/security";
import { dispatchNotificationsBestEffort } from "../../../lib/services/notification-dispatch-service";

const ALLOWED_TARGET_TYPES = [
  "user",
  "server",
  "product",
  "organization",
] as const;

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function privateJson(
  context: RequestLogContext,
  body: unknown,
  init: ResponseInit = {},
) {
  return jsonWithRequestId(context, body, {
    ...init,
    headers: privateHeaders,
  });
}

type TargetType =
  (typeof ALLOWED_TARGET_TYPES)[number];

function isTargetType(
  value: unknown,
): value is TargetType {
  return (
    typeof value === "string" &&
    ALLOWED_TARGET_TYPES.includes(
      value as TargetType,
    )
  );
}

async function targetExists(
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  switch (targetType) {
    case "user":
      return (
        (await userRepository.findById(targetId)) !==
        null
      );
    case "server": {
      const server =
        await serverRepository.findById(targetId);
      return (
        server !== null &&
        server.visibility !== "private" &&
        server.status !== "suspended"
      );
    }
    case "product": {
      const product =
        await productRepository.findById(targetId);
      return (
        product !== null &&
        product.status === "published" &&
        product.price === 0
      );
    }
    case "organization":
      return (
        (await organizationRepository.findById(
          targetId,
        )) !== null
      );
  }
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const targetType =
      request.nextUrl.searchParams.get(
        "targetType",
      ) || "";
    const targetId =
      request.nextUrl.searchParams.get("targetId") ||
      "";

    if (!isTargetType(targetType)) {
      return privateJson(
        context,
        { error: "Invalid target type" },
        { status: 400 },
      );
    }
    if (!targetId || targetId.length > 128) {
      return privateJson(
        context,
        { error: "Target ID required" },
        { status: 400 },
      );
    }

    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson(context, {
        authenticated: false,
        following: false,
      });
    }

    const following =
      await socialRepository.isFollowing(
        user.id,
        targetType,
        targetId,
      );
    return privateJson(context, {
      authenticated: true,
      following,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "follow.state_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Could not read follow state" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const rateLimit = await consumeRateLimit(
      "follow",
      user.id,
    );
    if (!rateLimit.success) {
      return privateJson(
        context,
        {
          error:
            "Too many follow requests. Please try again shortly.",
        },
        { status: 429 },
      );
    }

    const body = await request
      .json()
      .catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return privateJson(
        context,
        {
          error:
            "Request body must be an object",
        },
        { status: 400 },
      );
    }

    const { targetType, targetId } = body as {
      targetType?: unknown;
      targetId?: unknown;
    };

    if (!isTargetType(targetType)) {
      return privateJson(
        context,
        {
          error:
            `Invalid target type. Allowed: ${ALLOWED_TARGET_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (
      typeof targetId !== "string" ||
      targetId.length === 0 ||
      targetId.length > 128
    ) {
      return privateJson(
        context,
        { error: "Target ID required" },
        { status: 400 },
      );
    }

    if (!(await targetExists(targetType, targetId))) {
      return privateJson(
        context,
        { error: "Target does not exist" },
        { status: 404 },
      );
    }

    if (
      targetType === "user" &&
      targetId === user.id
    ) {
      return privateJson(
        context,
        { error: "Cannot follow yourself" },
        { status: 400 },
      );
    }

    const created = await socialRepository.follow({
      id: generateId("fol"),
      followerId: user.id,
      targetType,
      targetId,
    });

    if (!created) {
      const following =
        await socialRepository.isFollowing(
          user.id,
          targetType,
          targetId,
        );
      return privateJson(
        context,
        {
          error: following
            ? "Already following this target"
            : "Could not confirm follow",
          targetType,
          targetId,
          following,
        },
        {
          status: following ? 409 : 503,
        },
      );
    }

    if (
      targetType === "user" &&
      targetId !== user.id
    ) {
      after(async () => {
        try {
          await dispatchNotificationsBestEffort([
            {
              recipientId: targetId,
              title: "New Follower",
              message:
                `@${user.username} started following your activity.`,
              type: "system",
              category: "follow",
              link: `/users/${user.username}`,
            },
          ]);
        } catch (error) {
          logRequestEvent({
            level: "warn",
            event:
              "follow.notification_delivery_failed",
            context,
            status: 200,
            error,
          });
        }
      });
    }

    return privateJson(context, {
      success: true,
      targetType,
      targetId,
      following: true,
      follow: created,
    });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "follow.create_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Follow request failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const rateLimit = await consumeRateLimit(
      "follow",
      user.id,
    );
    if (!rateLimit.success) {
      return privateJson(
        context,
        {
          error:
            "Too many follow requests. Please try again shortly.",
        },
        { status: 429 },
      );
    }

    const body = await request
      .json()
      .catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return privateJson(
        context,
        {
          error:
            "Request body must be an object",
        },
        { status: 400 },
      );
    }

    const { targetType, targetId } = body as {
      targetType?: unknown;
      targetId?: unknown;
    };

    if (!isTargetType(targetType)) {
      return privateJson(
        context,
        { error: "Invalid target type" },
        { status: 400 },
      );
    }
    if (
      typeof targetId !== "string" ||
      targetId.length === 0 ||
      targetId.length > 128
    ) {
      return privateJson(
        context,
        { error: "Target ID required" },
        { status: 400 },
      );
    }

    await socialRepository.unfollow(
      user.id,
      targetType,
      targetId,
    );

    return privateJson(context, {
      success: true,
      targetType,
      targetId,
      following: false,
    });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "follow.delete_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Follow request failed" },
      { status: 500 },
    );
  }
}
