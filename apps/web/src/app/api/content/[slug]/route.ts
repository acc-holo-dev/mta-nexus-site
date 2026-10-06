import { type NextRequest, NextResponse } from "next/server";
import { contentService } from "../../../../lib/services/content-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const article = await contentService.getArticleBySlug(slug);
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const comments = await contentService.getComments({ contentId: article.id }, 100);
  return NextResponse.json(
    { content: article, comments },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}
