import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import {
  auditRepository,
  contentRepository,
  organizationRepository,
  productRepository,
} from "@nexus/db";
import { serverService } from "../../../lib/services/server-service";
import { productService } from "../../../lib/services/product-service";
import { createContentSchema } from "@nexus/validation";
import { can, consumeRateLimit, generateId } from "@nexus/security";

export async function GET(request: NextRequest) {
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "50");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 50;
  const content = await contentRepository.listPublished(limit);
  return NextResponse.json(
    { content, limit },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("contentCreation", user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Content creation limit exceeded" },
        { status: 429 }
      );
    }

    const parsed = createContentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid content details", details: parsed.error.format() },
        { status: 400 }
      );
    }

    if (parsed.data.serverId) {
      const linkedServer = await serverService.getServerById(parsed.data.serverId);
      if (!linkedServer) {
        return NextResponse.json(
          { error: "Linked server was not found" },
          { status: 404 },
        );
      }
      if (!(await serverService.canManageServer(linkedServer, user))) {
        return NextResponse.json(
          { error: "You do not manage the linked server" },
          { status: 403 },
        );
      }
    }

    if (parsed.data.productId) {
      const linkedProduct = await productRepository.findById(parsed.data.productId);
      if (!linkedProduct) {
        return NextResponse.json(
          { error: "Linked resource was not found" },
          { status: 404 },
        );
      }
      if (!(await productService.canManageProduct(linkedProduct, user))) {
        return NextResponse.json(
          { error: "You do not manage the linked resource" },
          { status: 403 },
        );
      }
    }
    if (parsed.data.organizationId) {
      const organization = await organizationRepository.findById(parsed.data.organizationId);
      if (!organization) {
        return NextResponse.json({ error: "Linked organization was not found" }, { status: 404 });
      }

      const memberships = await organizationRepository.listUserMemberships(user.id);
      const membership = memberships.find((item) => item.organizationId === parsed.data.organizationId);
      const canManageOrganization =
        organization.ownerId === user.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "developer";

      if (!canManageOrganization) {
        return NextResponse.json({ error: "You do not manage this organization" }, { status: 403 });
      }
    }

    const requestedStatus = parsed.data.status;
    const isCommunityTopic = parsed.data.type === "post" || parsed.data.type === "question";
    const status = requestedStatus === "published" &&
      (isCommunityTopic || can(user, "admin.moderation"))
      ? "published"
      : "draft";
    const contentItem = await contentRepository.create({
      ...parsed.data,
      status,
      id: generateId("cnt"),
      authorId: user.id,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      ...(status === "published" ? { publishedAt: new Date() } : {}),
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "content.created",
      targetId: contentItem.id,
      targetType: "content",
      details: { status, type: contentItem.type },
    });

    return NextResponse.json({ content: contentItem }, { status: 201 });
  } catch (error: unknown) {
    console.error("Content API error:", error);
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }
}
