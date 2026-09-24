import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) return json({ error: "Authentication required" }, 401);
    const [sessions, currentSessionId] = await Promise.all([
      authService.listSessions(user.id), authService.getCurrentSessionId(token),
    ]);
    return json({ sessions: sessions.map((session) => ({
      ...session, isCurrent: session.id === currentSessionId,
    })) });
  } catch {
    console.error("Session list could not be loaded");
    return json({ error: "Account settings are temporarily unavailable." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user || !token) return json({ error: "Authentication required" }, 401);
    const rateLimit = await consumeRateLimit("sessionManagement", user.id);
    if (!rateLimit.success) {
      return json({ error: "Too many session security requests. Please try again shortly." }, 429);
    }
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Request body must be an object" }, 400);
    }
    if (body.allOther === true) {
      const revokedCount = await authService.revokeOtherSessions(user.id, token);
      return json({ success: true, revokedCount });
    }
    if (typeof body.sessionId !== "string" || body.sessionId.length < 1) {
      return json({ error: "Provide a sessionId or set allOther to true" }, 400);
    }
    const currentSessionId = await authService.getCurrentSessionId(token);
    if (body.sessionId === currentSessionId) {
      return json({ error: "The current session cannot be revoked here; use logout instead" }, 409);
    }
    const revoked = await authService.revokeSession(user.id, body.sessionId, token);
    if (!revoked) return json({ error: "Session not found or not owned by you" }, 404);
    return json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    console.error("Session update could not be confirmed");
    return json({ error: "Could not confirm the session update. Reload settings before retrying." }, 503);
  }
}
