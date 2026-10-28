import type { NextRequest } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/observability";

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

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(context, {
        notifications: [],
        unreadCount: 0,
      });
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;
    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";

    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.listByUser(user.id, limit, unreadOnly),
      notificationRepository.countUnread(user.id),
    ]);

    return json(context, {
      notifications,
      unreadCount,
      limit,
      unreadOnly,
    });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "notifications.fetch_failed",
      context,
      status: 500,
      error,
    });
    return json(context, { error: "Failed to fetch notifications" }, 500);
  }
}
