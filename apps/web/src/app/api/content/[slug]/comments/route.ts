import { AppError, NotFoundError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import {
  discussionCommentSchema,
  parseDiscussionQuery,
} from "../../../../../lib/content-discussion-contract";
import { discussionError } from "../../../../../lib/content-discussion-copy";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/observability";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import { authService } from "../../../../../lib/services/auth-service";
import { contentService } from "../../../../../lib/services/content-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const validSlug = (slug: string) => !!slug && slug.length <= 200 && /^[a-z0-9-]+$/u.test(slug);
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const context = createRequestLogContext(request);
  try {
    const { slug } = await params;
    if (!validSlug(slug)) throw new NotFoundError("Content");
    const filters = parseDiscussionQuery(request.nextUrl.searchParams);
    if (!filters) throw new AppError("Invalid cursor", 400, "INVALID_CURSOR");
    if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
      throw new RateLimitExceededError();
    const article = await contentService.getArticleBySlug(slug, { incrementView: false });
    if (!article) throw new NotFoundError("Content");
    const page =
      filters.query || filters.focusId
        ? await contentService.pageDiscussion(article.id, filters.cursor, {
            query: filters.query,
            focusId: filters.focusId,
          })
        : await contentService.pageDiscussion(article.id, filters.cursor);
    return NextResponse.json(page, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const known = error instanceof AppError;
    if (!known)
      logRequestEvent({
        level: "error",
        event: "content.discussion.read_failed",
        context,
        status: 503,
        error,
      });
    return NextResponse.json(
      {
        error: discussionError(locale, known ? error.code : "INTERNAL_ERROR"),
        code: known ? error.code : "INTERNAL_ERROR",
      },
      {
        status: known ? error.statusCode : 503,
        headers: { "Cache-Control": "no-store", Vary: "Cookie" },
      },
    );
  }
}
export const POST = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const context = createRequestLogContext(request);
    const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
    try {
      const { slug } = await params;
      if (!validSlug(slug)) throw new NotFoundError("Content");
      const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
      if (!user) throw new UnauthorizedError();
      if (request.headers.get("sec-fetch-site") === "cross-site")
        throw new AppError("Cross-site mutation forbidden", 403, "FORBIDDEN");
      if (!(await consumeRateLimit("commentCreation", user.id)).success)
        throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      const parsed = discussionCommentSchema.safeParse(await readBoundedJson(request, 32 * 1024));
      if (!parsed.success) throw new AppError("Invalid comment", 400, "VALIDATION_ERROR");
      const article = await contentService.getArticleBySlug(slug, { incrementView: false });
      if (!article) throw new NotFoundError("Content");
      // Reply fanout is committed with the comment as discussion_notification_deliveries.
      const comment = await contentService.addComment(
        { contentId: article.id, parentId: parsed.data.parentId, text: parsed.data.text },
        user,
      );
      return jsonWithRequestId(context, { comment }, { status: 201, headers: privateHeaders });
    } catch (error) {
      const known = error instanceof AppError;
      const code = known ? error.code : "INTERNAL_ERROR";
      if (!known)
        logRequestEvent({
          level: "error",
          event: "content.comment.create_failed",
          context,
          status: 503,
          error,
        });
      return jsonWithRequestId(
        context,
        { error: discussionError(locale, code), code },
        { status: known ? error.statusCode : 503, headers: privateHeaders },
      );
    }
  },
);
