import { NextRequest, NextResponse } from "next/server";
import { contentService } from "../../../../../lib/services/content-service";
import { authService } from "../../../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";
import { createContentCommentSchema } from "@nexus/validation";
import { AppError } from "@nexus/domain";
import { consumeRateLimit, generateId } from "@nexus/security";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to comment" },
        { status: 401 }
      );
    }

    const rateLimit = await consumeRateLimit("commentCreation", user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many comments. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = createContentCommentSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid comment", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const article = await contentService.getArticleBySlug(slug, {
      incrementView: false,
    });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
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
      await notificationRepository
        .create({
          id: generateId("not"),
          recipientId: article.authorId,
          title: "New article comment",
          message: `@${user.username} commented on “${article.title}”.`,
          type: "content",
          category: "content",
          link: `/articles/${article.slug}`,
        })
        .catch(() => undefined);
    }

    return NextResponse.json(
      { comment },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Content comment error:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}
