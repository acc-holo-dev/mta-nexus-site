import { AppError, ValidationError } from "@nexus/domain";
import { can, consumeRateLimit, generateId } from "@nexus/security";
import { storageService } from "@nexus/storage";
import { type NextRequest, NextResponse } from "next/server";
import { adminBuildDownloadApiCopy } from "../../../../../../features/resources/admin-build-download-api-copy";
import {
  assertBuildDownloadMetadata,
  BuildArtifactMismatchError,
} from "../../../../../../features/resources/build-download-metadata";
import { toDownloadWebStream } from "../../../../../../features/resources/download-web-stream";
import { reviewerAttachmentFileName } from "../../../../../../features/resources/resource-attachment-filename";
import { resolveLocale } from "../../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  REQUEST_ID_HEADER,
  type RequestLogContext,
} from "../../../../../../lib/platform/observability";
import { authService } from "../../../../../../lib/services/accounts/auth-service";
import { productService } from "../../../../../../lib/services/commerce/product-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

function destroyOpenedStream(stream: NodeJS.ReadableStream): void {
  const destroyable = stream as NodeJS.ReadableStream & {
    destroy?: (error?: Error) => void;
  };
  destroyable.destroy?.();
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ buildId: string }>;
  },
) {
  const context = createRequestLogContext(request);
  const copy = adminBuildDownloadApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const actor = await authService.getSession(token);
    if (!actor || !can(actor, "admin.moderation")) {
      return json(
        context,
        {
          error: copy.moderatorRequired,
        },
        403,
      );
    }

    const rateLimit = await consumeRateLimit("download", `moderator:${actor.id}`);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const { buildId } = await params;
    if (!buildId || buildId.length > 128) {
      return json(context, { error: copy.notFound }, 404);
    }

    const build = await productService.findBuildById(buildId);
    if (!build) {
      return json(context, { error: copy.notFound }, 404);
    }

    if (build.status !== "pending_review" && build.status !== "quarantined") {
      return json(
        context,
        {
          error: copy.notAvailableForReview,
        },
        409,
      );
    }

    if (build.scanStatus !== "clean" || !build.scanner?.trim() || !build.scannedAt) {
      return json(
        context,
        {
          error: copy.scanProvenanceRequired,
        },
        422,
      );
    }

    const stored = await storageService.getDownloadStream(build.storageKey, request.signal);
    const contentLength = assertBuildDownloadMetadata(stored, build);

    try {
      request.signal.throwIfAborted();
      await productService.authorizeReviewDownload({
        actorId: actor.id,
        auditId: generateId("aud"),
        expected: build,
      });
      request.signal.throwIfAborted();
    } catch (error) {
      destroyOpenedStream(stored.stream);
      throw error;
    }

    const stream = toDownloadWebStream(stored.stream);

    return new NextResponse(stream, {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${reviewerAttachmentFileName(
          build.id,
          build.fileName,
        )}"`,
        "Content-Length": String(contentLength),
        "X-Resource-Content-Length": String(contentLength),
        "X-Content-SHA256": build.sha256Hash,
        "X-Content-Type-Options": "nosniff",
        [REQUEST_ID_HEADER]: context.requestId,
      },
    });
  } catch (error: unknown) {
    if (request.signal.aborted) {
      return json(
        context,
        {
          error: copy.cancelled,
          code: "DOWNLOAD_CANCELLED",
        },
        499,
      );
    }

    if (error instanceof BuildArtifactMismatchError) {
      return json(
        context,
        {
          error: copy.artifactMismatch,
          code: "BUILD_ARTIFACT_MISMATCH",
        },
        409,
      );
    }

    if (error instanceof ValidationError) {
      return json(
        context,
        {
          error: copy.fileUnavailable,
        },
        404,
      );
    }

    if (error instanceof AppError) {
      return json(context, { error: copy.evidenceChanged, code: error.code }, error.statusCode);
    }

    logRequestEvent({
      level: "error",
      event: "admin.build_download_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: copy.deliverFailed,
      },
      500,
    );
  }
}
