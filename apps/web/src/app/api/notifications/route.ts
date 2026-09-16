import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.listByUser(user.id, 50),
      notificationRepository.countUnread(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
