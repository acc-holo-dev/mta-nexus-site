import { after, type NextRequest, NextResponse } from "next/server";
import { AppError, NotFoundError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/observability";
import { contentService } from "../../../../../lib/services/content-service";
import { authService } from "../../../../../lib/services/auth-service";
import { dispatchNotificationsBestEffort } from "../../../../../lib/services/notification-dispatch-service";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { resolveLocale } from "../../../../../lib/i18n";
import { discussionError } from "../../../../../lib/content-discussion-copy";
import {
  discussionCommentSchema,
  parseDiscussionCursor,
} from "../../../../../lib/content-discussion-contract";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const validSlug = (slug: string) => !!slug && slug.length <= 200 && /^[a-z0-9-]+$/u.test(slug);
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const context = createRequestLogContext(request);
  try {
    const { slug } = await params;
    if (!validSlug(slug)) throw new NotFoundError("Content");
    const cursor = parseDiscussionCursor(request.nextUrl.searchParams);
    if (cursor === null) throw new AppError("Invalid cursor", 400, "INVALID_CURSOR");
    const article = await contentService.getArticleBySlug(slug, { incrementView: false });
    if (!article) throw new NotFoundError("Content");
    return NextResponse.json(await contentService.pageDiscussion(article.id, cursor), {
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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
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
    const comment = await contentService.addComment(
      { contentId: article.id, parentId: parsed.data.parentId, text: parsed.data.text },
      user,
    );
    // Delivery remains best effort after persistence; a delivery error never retries the write.
    if (article.authorId !== user.id || parsed.data.parentId)
      after(async () => {
        try {
          const parentAuthorId = parsed.data.parentId
            ? await contentService.commentAuthor(article.id, parsed.data.parentId)
            : null;
          const recipients = [
            ...new Set(
              [article.authorId, parentAuthorId].filter(
                (id): id is string => !!id && id !== user.id,
              ),
            ),
          ];
          await dispatchNotificationsBestEffort(
            recipients.map((recipientId) => ({
              recipientId,
              title: "New article comment",
              message: `@${user.username} commented on “${article.title}”.`,
              type: "content",
              category: "content",
              link: `/articles/${encodeURIComponent(article.slug)}#comment-${encodeURIComponent(comment.id)}`,
            })),
          );
        } catch (error) {
          logRequestEvent({
            level: "warn",
            event: "content.comment.notification_failed",
            context,
            status: 201,
            error,
          });
        }
      });
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
}
