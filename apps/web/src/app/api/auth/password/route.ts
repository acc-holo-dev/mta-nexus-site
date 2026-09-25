import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { changePasswordSchema } from "@nexus/validation";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user || !token) return json({ error: "Authentication required" }, 401);

    const rateLimit = await consumeRateLimit("passwordChange", user.id);
    if (!rateLimit.success) {
      return json({ error: "Too many password change attempts. Please try again later." }, 429);
    }
    const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "Password change validation failed", details: parsed.error.format() }, 400);
    }
    const changed = await authService.changePassword({
      userId: user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      currentToken: token,
    });
    const response = json({ success: true, revokedSessionCount: changed.revokedSessionCount });
    response.cookies.set("nexus_session", changed.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: changed.expiresAt,
      path: "/",
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    // SQL errors may include bound values: never log passwords, hashes or tokens.
    console.error("Password change could not be confirmed");
    return json({ error: "Could not confirm the password change. Sign in again before retrying." }, 503);
  }
}
