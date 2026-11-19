import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { serverReviewCommandSchema, serverReviewCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import {
  serverReviewCopy,
  serverReviewError,
} from "../../../../../features/servers/server-review-i18n";
import { serverReviewQuery } from "../../../../../features/servers/server-review-query";
import { getTrustedRequestIp } from "../../../../../features/shell/request-client-ip";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/platform/observability";
import { serverReviewService } from "../../../../../lib/services/servers/server-review-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store" };
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const copy = serverReviewCopy(locale);
  try {
    const query = serverReviewQuery(request.nextUrl.searchParams);
    const ip = getTrustedRequestIp(request);
    if (
      ip !== "unknown" &&
      !(await consumeRateLimit("resourceInspection", `server-review-ip:${ip}`)).success
    ) {
      throw new RateLimitExceededError();
    }
    return jsonWithRequestId(
      context,
      await serverReviewService.publicPage((await params).id, query.page),
      { headers },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return jsonWithRequestId(
        context,
        { code: error.code, error: serverReviewError(locale, error.code) },
        { status: error.statusCode, headers },
      );
    }
    if (error instanceof Error && /Ambiguous|Invalid review page/u.test(error.message)) {
      return jsonWithRequestId(
        context,
        { code: "REVIEW_INVALID", error: serverReviewError(locale, "REVIEW_INVALID") },
        { status: 400, headers },
      );
    }
    logRequestEvent({
      level: "error",
      event: "server.reviews_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      { code: "REVIEWS_UNAVAILABLE", error: copy.loadUnavailable },
      { status: 503, headers },
    );
  }
}

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    resourceCommerceRequest(request, true, async (actor) => {
      const raw = await readBoundedJson(request, 16384);
      const create = serverReviewCreateSchema.safeParse(raw);
      const parsed = create.success
        ? {
            success: true as const,
            data: { action: "save" as const, expectedRevision: 0, ...create.data },
          }
        : serverReviewCommandSchema.safeParse(raw);
      if (!parsed.success) throw new AppError("Invalid review", 400, "REVIEW_INVALID");
      const result = await serverReviewService.command(actor, (await params).id, parsed.data);
      return Response.json(
        { success: true, ...result },
        { status: parsed.data.action === "save" ? 201 : 200 },
      );
    }),
);
