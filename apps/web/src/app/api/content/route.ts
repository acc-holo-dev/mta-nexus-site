import { type NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import {
  contentRepository,
  organizationRepository,
  productRepository,
} from "@nexus/db";
import { serverService } from "../../../lib/services/server-service";
import { productService } from "../../../lib/services/product-service";
import { createContentSchema } from "@nexus/validation";
import {
  can,
  consumeRateLimit,
  generateId,
} from "@nexus/security";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const requestedLimit = Number(
    request.nextUrl.searchParams.get("limit") || "50",
  );
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 50;
  const content = await contentRepository.listPublished(limit);

  return NextResponse.json(
    { content, limit },
    {
      headers: {
        "Cache-Control":
          "public, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson(
        { error: "Authentication required" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "contentCreation",
      user.id,
    );
    if (!rateLimit.success) {
      return privateJson(
        { error: "Content creation limit exceeded" },
        429,
      );
    }

    const parsed = createContentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        {
          error: "Invalid content details",
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (parsed.data.serverId) {
      const linkedServer = await serverService.getServerById(
        parsed.data.serverId,
      );
      if (!linkedServer) {
        return privateJson(
          { error: "Linked server was not found" },
          404,
        );
      }

      if (
        !(await serverService.canManageServer(linkedServer, user))
      ) {
        return privateJson(
          { error: "You do not manage the linked server" },
          403,
        );
      }
    }

    if (parsed.data.productId) {
      const linkedProduct = await productRepository.findById(
        parsed.data.productId,
      );
      if (!linkedProduct) {
        return privateJson(
          { error: "Linked resource was not found" },
          404,
        );
      }

      if (
        !(await productService.canManageProduct(
          linkedProduct,
          user,
        ))
      ) {
        return privateJson(
          { error: "You do not manage the linked resource" },
          403,
        );
      }
    }

    if (parsed.data.organizationId) {
      const organization =
        await organizationRepository.findById(
          parsed.data.organizationId,
        );
      if (!organization) {
        return privateJson(
          { error: "Linked organization was not found" },
          404,
        );
      }

      const memberships =
        await organizationRepository.listUserMemberships(
          user.id,
        );
      const membership = memberships.find(
        (item) =>
          item.organizationId === parsed.data.organizationId,
      );
      const canManageOrganization =
        organization.ownerId === user.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "developer";

      if (!canManageOrganization) {
        return privateJson(
          { error: "You do not manage this organization" },
          403,
        );
      }
    }

    const isCommunityTopic =
      parsed.data.type === "post" ||
      parsed.data.type === "question";
    const status = isCommunityTopic
      ? "published"
      : parsed.data.status === "published" &&
          can(user, "admin.moderation")
        ? "published"
        : "draft";

    const contentId = generateId("cnt");
    const contentItem =
      await contentRepository.createWithAudit(
        {
          ...parsed.data,
          status,
          id: contentId,
          authorId: user.id,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          ...(status === "published"
            ? { publishedAt: new Date() }
            : {}),
        },
        {
          id: generateId("aud"),
          actorId: user.id,
          actorType: "user",
          action: "content.created",
          targetId: contentId,
          targetType: "content",
          details: {
            status,
            type: parsed.data.type,
          },
        },
      );

    return privateJson(
      { success: true, content: contentItem },
      201,
    );
  } catch (error: unknown) {
    console.error("Content API error:", error);
    return privateJson(
      { error: "Failed to create content" },
      500,
    );
  }
}
