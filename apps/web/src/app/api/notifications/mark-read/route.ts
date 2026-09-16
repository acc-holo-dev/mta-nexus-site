import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.id) {
      await notificationRepository.markAsRead(body.id);
    } else {
      await notificationRepository.markAllAsRead(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to mark notifications read" },
      { status: 500 }
    );
  }
}
