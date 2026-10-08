import type { NextRequest } from "next/server";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/observability";
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

const publicHeaders = {
  "Cache-Control":
    "public, max-age=30, stale-while-revalidate=120",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

function privateJson(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") ||
        "50",
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(
          Math.max(Math.floor(requestedLimit), 1),
          100,
        )
      : 50;
    const content =
      await contentRepository.listPublished(limit);

    // Keep the cacheable public representation free of a unique
    // correlation header; a CDN may replay cached response headers.
    return Response.json(
      { content, limit },
      { headers: publicHeaders },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "content.list_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "Published content is temporarily unavailable",
      },
      { status: 503, headers: errorHeaders },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson(
        context,
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
        context,
        {
          error:
            "Content creation limit exceeded",
        },
        429,
      );
    }

    const parsed = createContentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        {
          error: "Invalid content details",
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (parsed.data.serverId) {
      const linkedServer =
        await serverService.getServerById(
          parsed.data.serverId,
        );
      if (!linkedServer) {
        return privateJson(
          context,
          { error: "Linked server was not found" },
          404,
        );
      }

      if (
        !(await serverService.canManageServer(
          linkedServer,
          user,
        ))
      ) {
        return privateJson(
          context,
          {
            error:
              "You do not manage the linked server",
          },
          403,
        );
      }
    }

    if (parsed.data.productId) {
      const linkedProduct =
        await productRepository.findById(
          parsed.data.productId,
        );
      if (!linkedProduct) {
        return privateJson(
          context,
          {
            error:
              "Linked resource was not found",
          },
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
          context,
          {
            error:
              "You do not manage the linked resource",
          },
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
          context,
          {
            error:
              "Linked organization was not found",
          },
          404,
        );
      }

      const memberships =
        await organizationRepository.listUserMemberships(
          user.id,
        );
      const membership = memberships.find(
        (item) =>
          item.organizationId ===
          parsed.data.organizationId,
      );
      const canManageOrganization =
        organization.ownerId === user.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "developer";

      if (!canManageOrganization) {
        return privateJson(
          context,
          {
            error:
              "You do not manage this organization",
          },
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
      context,
      {
        success: true,
        content: contentItem,
      },
      201,
    );
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "content.create_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Failed to create content" },
      500,
    );
  }
}
