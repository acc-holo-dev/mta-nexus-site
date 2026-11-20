import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { claimResourceSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceClaimApiCopy } from "../../../../features/resources/resource-claim-api-copy";
import { getTrustedRequestIp } from "../../../../features/shell/request-client-ip";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";
import { commerceService } from "../../../../lib/services/commerce/commerce-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = resourceClaimApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const ip = getTrustedRequestIp(request);
    const rateLimit = await consumeRateLimit("resourceClaim", ip);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user || !token) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    requireServerJsonContentType(request);
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new AppError("Cross-site mutation is forbidden", 403, "FORBIDDEN");
    const parsed = claimResourceSchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) {
      return json(
        context,
        {
          error: copy.invalidClaim,
          details: parsed.error.format(),
        },
        400,
      );
    }

    const result = await commerceService.claimFreeResource({
      user,
      currentToken: token,
      productId: parsed.data.productId,
    });

    return json(context, result, result.alreadyClaimed ? 200 : 201);
  } catch (error: unknown) {
    const appError = error instanceof AppError ? error : null;
    logRequestEvent({
      level: "error",
      event: "resource.claim_failed",
      context,
      status: appError?.statusCode || 500,
      error,
    });
    return json(
      context,
      {
        error: appError
          ? localeAppErrorText(
              appError,
              {
                unauthorized: copy.authenticationRequired,
                forbidden: copy.forbidden,
                notFound: copy.notFound,
                unsupportedMediaType: copy.unsupportedMediaType,
                requestBodyTooLarge: copy.requestBodyTooLarge,
                invalidBodyLength: copy.invalidBodyLength,
                requestBodyTimeout: copy.requestBodyTimeout,
                failed: copy.claimFailed,
              },
              { VALIDATION_ERROR: copy.invalidClaim },
            )
          : copy.claimFailed,
        ...(appError ? { code: appError.code } : {}),
      },
      appError?.statusCode || 500,
    );
  }
});
