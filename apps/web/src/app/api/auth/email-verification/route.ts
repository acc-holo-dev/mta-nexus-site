import { type NextRequest, NextResponse } from "next/server";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import {
  confirmRecoveryEmailVerificationSchema,
  requestRecoveryEmailVerificationSchema,
} from "@nexus/validation";
import { AppError } from "@nexus/domain";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

async function actor(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);
  if (!token || !user) return null;
  return { token, user };
}

export async function GET(request: NextRequest) {
  try {
    const current = await actor(request);
    if (!current) return json({ error: "Authentication required" }, 401);
    const status = await authService.getRecoveryEmailStatus(current.user.id);
    if (!status) return json({ error: "Authentication required" }, 401);
    return json({
      email: status.email,
      verified: status.verified,
      verifiedAt: status.verifiedAt,
      eligible: status.eligible,
    });
  } catch {
    return json({ error: "Could not check recovery email status" }, 503);
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const current = await actor(request);
    if (!current) return json({ error: "Authentication required" }, 401);
    const parsed = requestRecoveryEmailVerificationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return json({ error: "Email verification validation failed", details: parsed.error.format() }, 400);
    }
    const result = await authService.requestRecoveryEmailVerification({
      userId: current.user.id,
      currentToken: current.token,
      currentPassword: parsed.data.currentPassword,
    });
    if (result.alreadyVerified) return json({ accepted: false, alreadyVerified: true });
    return json({
      accepted: true,
      alreadyVerified: false,
      expiresAt: result.expiresAt,
    }, 202);
  } catch (error: unknown) {
    if (error instanceof AppError) return json({ error: error.message, code: error.code }, error.statusCode);
    // Configuration/DB/queue failures may contain secret-bearing context.
    logRequestEvent({
      level: "error",
      event: "auth.recovery_email.request_failed",
      context,
      status: 503,
      error,
    });
    return json({ error: "Could not start email verification. Please try again later." }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const current = await actor(request);
    if (!current) return json({ error: "Authentication required" }, 401);
    const parsed = confirmRecoveryEmailVerificationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return json({ error: "Invalid or expired email confirmation" }, 400);
    const result = await authService.confirmRecoveryEmailVerification({
      userId: current.user.id,
      currentToken: current.token,
      challengeId: parsed.data.challengeId,
      token: parsed.data.token,
    });
    return json({ success: true, email: result.email, verifiedAt: result.verifiedAt });
  } catch (error: unknown) {
    if (error instanceof AppError) return json({ error: error.message, code: error.code }, error.statusCode);
    logRequestEvent({
      level: "error",
      event: "auth.recovery_email.confirm_failed",
      context,
      status: 503,
      error,
    });
    return json({ error: "Could not confirm this email. Please try again later." }, 503);
  }
}
