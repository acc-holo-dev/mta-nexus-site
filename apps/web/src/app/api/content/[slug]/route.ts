import type { NextRequest } from "next/server";
import { contentService } from "../../../../lib/services/content-service";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";

const publicHeaders = {
  "Cache-Control":
    "public, max-age=30, stale-while-revalidate=120",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const context = createRequestLogContext(request);

  try {
    const { slug } = await params;

    if (
      !slug ||
      slug.length > 200 ||
      !/^[a-z0-9-]+$/u.test(slug)
    ) {
      return jsonWithRequestId(
        context,
        { error: "Article not found" },
        { status: 404, headers: errorHeaders },
      );
    }

    const article =
      await contentService.getArticleBySlug(slug);
    if (!article) {
      return jsonWithRequestId(
        context,
        { error: "Article not found" },
        { status: 404, headers: errorHeaders },
      );
    }

    const comments = await contentService.getComments(
      { contentId: article.id },
      100,
    );

    // A unique per-request correlation ID must not be embedded in a
    // cacheable public representation: intermediaries may replay it.
    return Response.json(
      { content: article, comments },
      { headers: publicHeaders },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "content.detail_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "Article is temporarily unavailable",
      },
      { status: 503, headers: errorHeaders },
    );
  }
}
