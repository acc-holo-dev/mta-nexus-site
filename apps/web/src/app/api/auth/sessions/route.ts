import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { consumeRateLimit } from "@nexus/security";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const [sessions, currentSessionId] = await Promise.all([
    authService.listSessions(user.id),
    authService.getCurrentSessionId(token),
  ]);
  return NextResponse.json(
    { sessions: sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    })) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("sessionManagement", user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many session security requests. Please try again shortly." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body.allOther === true) {
      const revokedCount = await authService.revokeOtherSessions(user.id, token);
      return NextResponse.json({ success: true, revokedCount });
    }

    if (typeof body.sessionId !== "string" || body.sessionId.length < 1) {
      return NextResponse.json(
        { error: "Provide a sessionId or set allOther to true" },
        { status: 400 }
      );
    }

    const currentSessionId = await authService.getCurrentSessionId(token);
    if (body.sessionId === currentSessionId) {
      return NextResponse.json(
        { error: "The current session cannot be revoked here; use logout instead" },
        { status: 409 }
      );
    }

    const revoked = await authService.revokeSession(user.id, body.sessionId);
    if (!revoked) {
      return NextResponse.json(
        { error: "Session not found or not owned by you" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Session security error:", error);
    return NextResponse.json({ error: "Failed to update sessions" }, { status: 500 });
  }
}
