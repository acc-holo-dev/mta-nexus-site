import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { confirmPasswordResetSchema, requestPasswordResetSchema } from "@nexus/validation";
import { AppError } from "@nexus/domain";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";

const neutral = {
  accepted: true,
  message: "If an eligible account uses that email, a password reset link will be sent.",
} as const;
const headers = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};
const requestFloorMinMs = 900;
const requestFloorJitterMs = 300;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

function requestTargetMs(): number {
  return requestFloorMinMs + randomInt(0, requestFloorJitterMs + 1);
}

async function floor(startedAt: number, targetMs: number) {
  const remaining = targetMs - (performance.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}


export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const targetMs = requestTargetMs();
  const parsed = requestPasswordResetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  try {
    await authService.requestPasswordReset({
      email: parsed.data.email,
      ip: getTrustedRequestIp(request),
    });
    await floor(startedAt, targetMs);
    return json(neutral, 202);
  } catch {
    // Missing dedicated keys or shared persistence failure makes recovery
    // unavailable for every address; do not expose account-specific detail.
    console.error("Password reset request service is unavailable");
    await floor(startedAt, targetMs);
    return json({ error: "Password reset is temporarily unavailable. Please try again later." }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = confirmPasswordResetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid or expired password reset" }, 400);
  try {
    await authService.confirmPasswordReset(parsed.data);
    return json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AppError) return json({ error: "Invalid or expired password reset" }, 400);
    console.error("Password reset could not be confirmed");
    return json({ error: "Could not reset the password. Request a new link and try again." }, 503);
  }
}
