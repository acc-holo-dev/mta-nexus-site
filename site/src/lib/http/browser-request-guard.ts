import type { NextRequest } from "next/server";
import { resolveLocale } from "../i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../platform/observability";
import { browserRequestApiCopy } from "./browser-request-api-copy";
import { browserRequestDecision } from "./browser-request-policy";

/** Call before reading a body, consuming a rate limit, or resolving a session. */
export function rejectUnsafeBrowserRequest(request: NextRequest) {
  const decision = browserRequestDecision(request);
  if (decision.allowed) return null;
  const context = createRequestLogContext(request);
  const copy = browserRequestApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  logRequestEvent({
    level: decision.status === 503 ? "error" : "warn",
    event: "request.browser_boundary_rejected",
    context,
    status: decision.status,
    fields: { reason: decision.code },
  });
  return jsonWithRequestId(
    context,
    {
      error: decision.status === 503 ? copy.configurationUnavailable : copy.originNotAllowed,
      code: decision.code,
    },
    {
      status: decision.status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie, Origin, Referer, Sec-Fetch-Site",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
