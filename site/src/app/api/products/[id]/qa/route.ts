import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { resourceQaAskSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import {
  resourceQaCopy,
  resourceQaError,
} from "../../../../../features/resources/resource-qa-i18n";
import { resourceQaQuery } from "../../../../../features/resources/resource-qa-query";
import { getTrustedRequestIp } from "../../../../../features/shell/request-client-ip";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/platform/observability";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { resourceQaService } from "../../../../../lib/services/resources/resource-qa-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const copy = resourceQaCopy(locale);
  try {
    const query = resourceQaQuery(request.nextUrl.searchParams);
    const ip = getTrustedRequestIp(request);
    if (ip !== "unknown" && !(await consumeRateLimit("resourceInspection", `qa-ip:${ip}`)).success)
      throw new RateLimitExceededError();
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    return jsonWithRequestId(
      context,
      await resourceQaService.publicPage((await params).id, query.page, actor),
      { headers },
    );
  } catch (error) {
    if (error instanceof AppError)
      return jsonWithRequestId(
        context,
        { code: error.code, error: resourceQaError(locale, error.code) },
        { status: error.statusCode, headers },
      );
    logRequestEvent({
      level: "error",
      event: "product.qa_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      { code: "RESOURCE_QA_UNAVAILABLE", error: copy.unavailable },
      { status: 503, headers },
    );
  }
}

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    resourceCommerceRequest(request, true, async (actor) => {
      const body = resourceQaAskSchema.safeParse(await readBoundedJson(request, 16384));
      if (!body.success) throw new AppError("Invalid Q&A command", 400, "RESOURCE_QA_INVALID");
      const result = await resourceQaService.ask(actor, (await params).id, {
        action: "ask",
        ...body.data,
      });
      return Response.json({ success: true, ...result }, { status: 201 });
    }),
);
