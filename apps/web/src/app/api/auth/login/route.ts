import { NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { loginSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "../../../../lib/observability";

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const ip = getTrustedRequestIp(request);
    const rl = await consumeRateLimit("authLogin", ip);
    if (!rl.success) {
      logRequestEvent({
        level: "warn",
        event: "auth.login.rate_limited",
        context,
        status: 429,
      });
      return jsonWithRequestId(
        context,
        { error: "Too many login attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithRequestId(
        context,
        { error: "Invalid login credentials", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { user, token } = await authService.login(parsed.data);

    const response = jsonWithRequestId(context, { success: true, user });
    response.cookies.set("nexus_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return jsonWithRequestId(
        context,
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    logRequestEvent({
      level: "error",
      event: "auth.login.failed",
      context,
      status: 500,
      error,
    });
    return jsonWithRequestId(context, { error: "Failed to log in" }, { status: 500 });
  }
}
