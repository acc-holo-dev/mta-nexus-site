import { AppError } from "@nexus/domain";
import {
  confirmRecoveryEmailVerificationSchema,
  requestRecoveryEmailVerificationSchema,
} from "@nexus/validation";
import { type NextRequest, NextResponse } from "next/server";
import { authEmailVerificationApiCopy } from "../../../../features/accounts/auth-email-verification-api-copy";
import { readAuthJson } from "../../../../lib/http/auth-request-body";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../lib/i18n";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

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
  const copy = authEmailVerificationApiCopy(
    resolveLocale(request.cookies.get("nexus_locale")?.value),
  );
  try {
    const current = await actor(request);
    if (!current) return json({ error: copy.authenticationRequired }, 401);
    const status = await authService.getRecoveryEmailStatus(current.user.id);
    if (!status) return json({ error: copy.authenticationRequired }, 401);
    return json({
      actorId: current.user.id,
      email: status.email,
      verified: status.verified,
      verifiedAt: status.verifiedAt,
      eligible: status.eligible,
    });
  } catch {
    return json({ error: copy.statusUnavailable }, 503);
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authEmailVerificationApiCopy(
    resolveLocale(request.cookies.get("nexus_locale")?.value),
  );
  try {
    const current = await actor(request);
    if (!current) return json({ error: copy.authenticationRequired }, 401);
    const parsed = requestRecoveryEmailVerificationSchema.safeParse(await readAuthJson(request));
    if (!parsed.success) {
      return json({ error: copy.validationFailed, details: parsed.error.format() }, 400);
    }
    if (parsed.data.expectedActorId !== current.user.id) {
      return json({ error: copy.accountChanged, code: "ACTOR_CHANGED" }, 409);
    }
    const result = await authService.requestRecoveryEmailVerification({
      userId: current.user.id,
      currentToken: current.token,
      currentPassword: parsed.data.currentPassword,
    });
    if (result.alreadyVerified) return json({ accepted: false, alreadyVerified: true });
    return json(
      {
        accepted: true,
        alreadyVerified: false,
        expiresAt: result.expiresAt,
      },
      202,
    );
  } catch (error: unknown) {
    if (error instanceof AppError)
      return json({ error: error.message, code: error.code }, error.statusCode);
    // Configuration/DB/queue failures may contain secret-bearing context.
    logRequestEvent({
      level: "error",
      event: "auth.recovery_email.request_failed",
      context,
      status: 503,
      error,
    });
    return json({ error: copy.startFailed }, 503);
  }
});

export const PATCH = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authEmailVerificationApiCopy(
    resolveLocale(request.cookies.get("nexus_locale")?.value),
  );
  try {
    const current = await actor(request);
    if (!current) return json({ error: copy.authenticationRequired }, 401);
    const parsed = confirmRecoveryEmailVerificationSchema.safeParse(await readAuthJson(request));
    if (!parsed.success) return json({ error: copy.invalidOrExpired }, 400);
    const result = await authService.confirmRecoveryEmailVerification({
      userId: current.user.id,
      currentToken: current.token,
      challengeId: parsed.data.challengeId,
      token: parsed.data.token,
    });
    return json({ success: true, email: result.email, verifiedAt: result.verifiedAt });
  } catch (error: unknown) {
    if (error instanceof AppError)
      return json({ error: error.message, code: error.code }, error.statusCode);
    logRequestEvent({
      level: "error",
      event: "auth.recovery_email.confirm_failed",
      context,
      status: 503,
      error,
    });
    return json({ error: copy.confirmFailed }, 503);
  }
});
