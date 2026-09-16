import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { registerSchema } from "@nexus/validation";
import { rateLimiter } from "@nexus/security";

export async function POST(request: NextRequest) {
  try {
    // Abuse protection: limit registrations per IP
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = await rateLimiter.consume(`register:${ip}`, 5, 3600);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to register" },
      { status: error.statusCode || 400 }
    );
  }
}
