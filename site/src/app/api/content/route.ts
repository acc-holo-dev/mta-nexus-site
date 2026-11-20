import { AppError } from "@nexus/domain";
import { can, consumeRateLimit, generateId } from "@nexus/security";
import { createContentSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { contentApiCopy } from "../../../features/community/content-api-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/platform/observability";
import { isPostgresDeadlock } from "../../../lib/platform/postgres-error";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { contentService } from "../../../lib/services/community/content-service";
import { serverService } from "../../../lib/services/servers/server-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const publicHeaders = {
  "Cache-Control": "no-store",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

function privateJson(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = contentApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;
    const content = await contentService.listPublished(limit);

    // Visibility of associated servers and resources can change at any time.
    return Response.json({ content, limit }, { headers: publicHeaders });
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
        error: copy.listUnavailable,
      },
      { status: 503, headers: errorHeaders },
    );
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = contentApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!token || !user) {
      return privateJson(context, { error: copy.authenticationRequired }, 401);
    }

    const expectedActor = request.headers.get("x-nexus-actor-id");
    if (!expectedActor)
      return privateJson(context, { code: "ACTOR_ID_REQUIRED", error: copy.actorRequired }, 428);
    if (expectedActor !== user.id)
      return privateJson(context, { code: "ACTOR_CHANGED", error: copy.actorChanged }, 409);

    requireServerJsonContentType(request);
    const rateLimit = await consumeRateLimit("contentCreation", user.id);
    if (!rateLimit.success) {
      return privateJson(
        context,
        {
          error: copy.creationLimitExceeded,
        },
        429,
      );
    }

    const parsed = createContentSchema.safeParse(await readBoundedJson(request, 128 * 1024));
    if (!parsed.success) {
      return privateJson(
        context,
        {
          error: copy.invalidDetails,
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (parsed.data.serverId) {
      const linkedServer = await serverService.getServerById(parsed.data.serverId);
      if (!linkedServer) {
        return privateJson(context, { error: copy.linkedServerNotFound }, 404);
      }

      if (!(await serverService.canManageServer(linkedServer, user))) {
        return privateJson(
          context,
          {
            error: copy.linkedServerNotManaged,
          },
          403,
        );
      }
    }

    if (parsed.data.productId) {
      const linkedProduct = await productService.findProductRecord(parsed.data.productId);
      if (!linkedProduct) {
        return privateJson(
          context,
          {
            error: copy.linkedResourceNotFound,
          },
          404,
        );
      }

      if (!(await productService.canManageProduct(linkedProduct, user))) {
        return privateJson(
          context,
          {
            error: copy.linkedResourceNotManaged,
          },
          403,
        );
      }
    }

    if (parsed.data.organizationId) {
      const organization = await authService.findOrganizationById(parsed.data.organizationId);
      if (!organization) {
        return privateJson(
          context,
          {
            error: copy.linkedOrganizationNotFound,
          },
          404,
        );
      }

      const memberships = await authService.listUserMemberships(user.id);
      const membership = memberships.find(
        (item) => item.organizationId === parsed.data.organizationId,
      );
      const canManageOrganization =
        organization.ownerId === user.id ||
        membership?.role === "admin" ||
        membership?.role === "developer";

      if (!canManageOrganization) {
        return privateJson(
          context,
          {
            error: copy.organizationNotManaged,
          },
          403,
        );
      }
    }

    const isCommunityTopic = parsed.data.type === "post" || parsed.data.type === "question";
    const status = isCommunityTopic
      ? "published"
      : parsed.data.status === "published" && can(user, "admin.moderation")
        ? "published"
        : "draft";

    const contentId = generateId("cnt");
    const contentItem = await contentService.createWithAudit(
      {
        ...parsed.data,
        status,
        id: contentId,
        authorId: user.id,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        ...(status === "published" ? { publishedAt: new Date() } : {}),
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
      token,
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
    if (isPostgresDeadlock(error)) {
      return privateJson(
        context,
        { error: copy.creationRetry, code: "CONTENT_CREATION_RETRY" },
        409,
      );
    }
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
        "FORBIDDEN",
        "NOT_FOUND",
        "UNAUTHORIZED",
      ].includes(error.code)
    ) {
      return privateJson(
        context,
        {
          error: localeAppErrorText(error, {
            unauthorized: copy.authenticationRequired,
            forbidden: copy.forbidden,
            notFound: copy.notFound,
            unsupportedMediaType: copy.unsupportedMediaType,
            requestBodyTooLarge: copy.requestBodyTooLarge,
            invalidBodyLength: copy.invalidBodyLength,
            requestBodyTimeout: copy.requestBodyTimeout,
            failed: copy.createFailed,
          }),
          code: error.code,
        },
        error.statusCode,
      );
    }
    logRequestEvent({
      level: "error",
      event: "content.create_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(context, { error: copy.createFailed }, 500);
  }
});
