import { type NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ notifications: [], unreadCount: 0 }, { headers: privateHeaders });
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

    return NextResponse.json(
      { notifications, unreadCount, limit, unreadOnly },
      { headers: privateHeaders }
    );
  } catch (error: unknown) {
    console.error("Notification fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500, headers: privateHeaders });
  }
}
