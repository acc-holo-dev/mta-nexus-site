import { after, type NextRequest, NextResponse } from "next/server";
import { createRequestLogContext, logRequestEvent } from "../../../../../lib/observability";
import { contentService } from "../../../../../lib/services/content-service";
import { authService } from "../../../../../lib/services/auth-service";
import { createContentCommentSchema } from "@nexus/validation";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { dispatchNotificationsBestEffort } from "../../../../../lib/services/notification-dispatch-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const context = createRequestLogContext(request);
  try {
    const { slug } = await params;
    if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/.test(slug)) {
      return json({ error: "Article not found" }, 404 );
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return json(
        { error: "Authentication required to comment" },
        401 
      );
    }

    const rateLimit = await consumeRateLimit("commentCreation", user.id);
    if (!rateLimit.success) {
      return json(
        { error: "Too many comments. Please try again later." },
        429 
      );
    }

    const parsed = createContentCommentSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return json(
        { error: "Invalid comment", details: parsed.error.format() },
        400 
      );
    }

    const article = await contentService.getArticleBySlug(slug, {
      incrementView: false,
    });
    if (!article) {
      return json({ error: "Article not found" }, 404 );
    }

    const comment = await contentService.addComment(
      {
        contentId: article.id,
        parentId: parsed.data.parentId,
        text: parsed.data.text,
      },
      user
    );

    if (article.authorId !== user.id) {
      after(async () => {
        try {
          await dispatchNotificationsBestEffort([
            {
            recipientId: article.authorId,
            title: "New article comment",
            message: `@${user.username} commented on “${article.title}”.`,
            type: "content",
            category: "content",
            link: `/articles/${article.slug}`,
          },
          ]);
        } catch {
          // The comment commit is authoritative; notification/push is best effort.
        }
      });
    }

    return json(
      { comment },
      201,
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        { error: error.message, code: error.code },
        error.statusCode 
      );
    }

    logRequestEvent({
      level: "error",
      event: "content.comment.create_failed",
      context,
      status: 500,
      error,
    });
    return json(
      { error: "Failed to add comment" },
      500 
    );
  }
}
