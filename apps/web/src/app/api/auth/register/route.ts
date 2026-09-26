import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { registerSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";

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
    const ip = getTrustedRequestIp(request);
    const rl = await consumeRateLimit("authRegistration", ip);
    if (!rl.success) {
      return json(
        {
          error:
            "Too many registration attempts. Please try again later.",
        },
        429,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        {
          error: "Validation failed",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const { user, token } = await authService.register(parsed.data);

    const response = json({ success: true, user }, 201);
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
      return json(
        { error: error.message, code: error.code },
        error.statusCode,
      );
    }

    console.error("Registration failed", error);
    return json({ error: "Failed to register" }, 500);
  }
}
