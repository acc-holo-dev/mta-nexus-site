import { type NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";
import { consumeRateLimit } from "@nexus/security";
import { parseNotificationReadTarget } from "../../../../lib/notification-read";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json({ error: "Unauthorized" }, 401 );
    }

    const rateLimit = await consumeRateLimit("notificationMutation", user.id);
    if (!rateLimit.success) {
      return json(
        { error: "Too many notification updates. Please try again shortly." },
        429 
      );
    }

    const target = parseNotificationReadTarget(await request.text());
    if (!target) {
      return json({ error: "Invalid notification target" }, 400);
    }
    if (target.scope === "single") {
      // IDOR protection: only mark notifications owned by the current user.
      const updated = await notificationRepository.markAsRead(target.id, user.id);
      if (!updated) {
        return json({ error: "Notification not found or not owned by you" }, 404);
      }
      return json({ success: true, scope: "single", id: target.id });
    }

    await notificationRepository.markAllAsRead(user.id);
    return json({ success: true, scope: "all" });
  } catch (error: unknown) {
    console.error("Notification update error:", error);
    return json({ error: "Failed to mark notifications read" }, 500 );
  }
}
