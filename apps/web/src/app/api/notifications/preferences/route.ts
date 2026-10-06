import { type NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";
import { notificationPreferencesSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: privateHeaders });
  }

  const preferences = await notificationRepository.getPreferences(user.id);
  return NextResponse.json(
    { preferences },
    { headers: privateHeaders }
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: privateHeaders },
      );
    }

    const rateLimit = await consumeRateLimit("notificationMutation", user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many preference updates. Please try again shortly." },
        { status: 429, headers: privateHeaders },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = notificationPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid notification preferences", details: parsed.error.format() },
        { status: 400, headers: privateHeaders },
      );
    }

    const preferences = await notificationRepository.updatePreferences(user.id, parsed.data);
    return NextResponse.json(
      { success: true, preferences },
      { headers: privateHeaders },
    );
  } catch (error: unknown) {
    console.error("Notification preferences error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500, headers: privateHeaders },
    );
  }
}
