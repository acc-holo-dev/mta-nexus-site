import type { NextRequest } from "next/server";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";
import { contentService } from "../../../../lib/services/content-service";

const publicHeaders = {
  "Cache-Control": "no-store",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const context = createRequestLogContext(request);

  try {
    const { slug } = await params;

    if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/u.test(slug)) {
      return jsonWithRequestId(
        context,
        { error: "Article not found" },
        { status: 404, headers: errorHeaders },
      );
    }

    const article = await contentService.getArticleBySlug(slug);
    if (!article) {
      return jsonWithRequestId(
        context,
        { error: "Article not found" },
        { status: 404, headers: errorHeaders },
      );
    }

    const comments = await contentService.getComments({ contentId: article.id }, 100);

    // Avoid storing an association after its visibility changes.
    return Response.json({ content: article, comments }, { headers: publicHeaders });
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
        error: "Article is temporarily unavailable",
      },
      { status: 503, headers: errorHeaders },
    );
  }
}
