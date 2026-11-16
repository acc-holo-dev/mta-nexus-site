import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import type { Locale } from "./i18n";
import { resolveLocale } from "./i18n";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";
export async function publicPlatformApi(
  request: NextRequest,
  action: () => Promise<unknown>,
  translateError: (locale: Locale, code: unknown) => string,
  privateState = false,
) {
  const context = createRequestLogContext(request),
    headers = { "Cache-Control": privateState ? "private, no-store" : "no-store", Vary: "Cookie" };
  try {
    return jsonWithRequestId(context, await action(), { headers });
  } catch (error) {
    const known = error instanceof AppError,
      code = known ? error.code : "INTERNAL_ERROR",
      status = known ? error.statusCode : 503;
    if (!known)
      logRequestEvent({
        level: "error",
        event: "public_platform.request_failed",
        context,
        status,
        error,
      });
    return jsonWithRequestId(
      context,
      {
        code,
        error: translateError(resolveLocale(request.cookies.get("nexus_locale")?.value), code),
      },
      { status, headers },
    );
  }
}
