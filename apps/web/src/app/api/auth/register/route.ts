import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { registerSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedRequestIp(request);
    const rl = await consumeRateLimit("authRegistration", ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { user, token } = await authService.register(parsed.data);

    const response = NextResponse.json({ success: true, user }, { status: 201 });
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
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Registration failed", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
