import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { requireServerJsonContentType } from "./bounded-json";
import { resolveLocale } from "./i18n";
import { supportWorkspaceError } from "./support-workspace-copy";
import { jsonWithRequestId, logRequestEvent } from "./observability";
type Context = Parameters<typeof jsonWithRequestId>[0];
export function supportPrivateJson(
  context: Context,
  request: NextRequest,
  body: unknown,
  init: ResponseInit = {},
) {
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const value =
    body && typeof body === "object" && "error" in body
      ? {
          ...body,
          ...(locale === "ru"
            ? { error: supportWorkspaceError(locale, "code" in body ? body.code : init.status) }
            : {}),
        }
      : body;
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie");
  return jsonWithRequestId(context, value, { ...init, headers });
}
export function supportMutationGuard(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError("Cross-site mutation forbidden", 403, "FORBIDDEN");
  requireServerJsonContentType(request);
}
export function supportFailure(
  request: NextRequest,
  context: Context,
  error: unknown,
  event: string,
) {
  if (error instanceof AppError)
    return supportPrivateJson(
      context,
      request,
      {
        error: supportWorkspaceError(
          resolveLocale(request.cookies.get("nexus_locale")?.value),
          error.code,
        ),
        code: error.code,
      },
      { status: error.statusCode },
    );
  logRequestEvent({ level: "error", event, context, status: 500, error });
  return supportPrivateJson(
    context,
    request,
    {
      error: supportWorkspaceError(
        resolveLocale(request.cookies.get("nexus_locale")?.value),
        "INTERNAL_ERROR",
      ),
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
