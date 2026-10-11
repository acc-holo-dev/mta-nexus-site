import type { NextRequest } from "next/server";
import { AppError, NotFoundError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { parsePublicationQuery } from "../../../../../lib/publication-feed-contract";
import { publicationError } from "../../../../../lib/publication-feed-copy";
import { publicationFeedService } from "../../../../../lib/services/publication-feed-service";
import { resolveLocale } from "../../../../../lib/i18n";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/observability";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; handle: string }> },
) {
  const context = createRequestLogContext(request);
  try {
    const { kind, handle } = await params;
    if (kind !== "user" && kind !== "organization" && kind !== "server")
      throw new NotFoundError("Profile");
    const query = parsePublicationQuery(request.nextUrl.searchParams, false, kind === "server");
    if (!query) throw new AppError("Invalid filters", 400, "VALIDATION_ERROR");
    if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
      throw new RateLimitExceededError();
    const profile = await publicationFeedService.resolve(kind, handle);
    return jsonWithRequestId(
      context,
      await publicationFeedService.page({ kind, id: profile.id }, query),
      {
        headers: { "Cache-Control": "no-store", Vary: "Cookie" },
      },
    );
  } catch (error) {
    const known = error instanceof AppError,
      code = known ? error.code : "INTERNAL_ERROR";
    if (!known)
      logRequestEvent({
        level: "error",
        event: "publication.activity_failed",
        context,
        status: 503,
        error,
      });
    return jsonWithRequestId(
      context,
      {
        code,
        error: publicationError(resolveLocale(request.cookies.get("nexus_locale")?.value), code),
      },
      {
        status: known ? error.statusCode : 503,
        headers: { "Cache-Control": "no-store", Vary: "Cookie" },
      },
    );
  }
}
