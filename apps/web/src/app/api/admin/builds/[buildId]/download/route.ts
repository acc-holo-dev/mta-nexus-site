import { reviewerAttachmentFileName } from "../../../../../../lib/resource-attachment-filename";
import { ValidationError } from "@nexus/domain";
import {
  auditRepository,
  buildRepository,
} from "@nexus/db";
import {
  can,
  consumeRateLimit,
  generateId,
} from "@nexus/security";
import { storageService } from "@nexus/storage";
import { type NextRequest, NextResponse } from "next/server";
import {
  assertBuildDownloadMetadata,
  BuildArtifactMismatchError,
} from "../../../../../../lib/build-download-metadata";
import { toDownloadWebStream } from "../../../../../../lib/download-web-stream";
import {
  REQUEST_ID_HEADER,
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../../lib/observability";
import { authService } from "../../../../../../lib/services/auth-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

function destroyOpenedStream(
  stream: NodeJS.ReadableStream,
): void {
  const destroyable =
    stream as NodeJS.ReadableStream & {
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

  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const actor = await authService.getSession(token);
    if (
      !actor ||
      !can(actor, "admin.moderation")
    ) {
      return json(
        context,
        {
          error:
            "Moderator access required",
        },
        403,
      );
    }

    const rateLimit = await consumeRateLimit(
      "download",
      `moderator:${actor.id}`,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many reviewer downloads",
        },
        429,
      );
    }

    const { buildId } = await params;
    if (!buildId || buildId.length > 128) {
      return json(
        context,
        { error: "Build not found" },
        404,
      );
    }

    const build =
      await buildRepository.findById(buildId);
    if (!build) {
      return json(
        context,
        { error: "Build not found" },
        404,
      );
    }

    if (
      build.status !== "pending_review" &&
      build.status !== "quarantined"
    ) {
      return json(
        context,
        {
          error:
            "Build is not available for moderator evidence review",
        },
        409,
      );
    }

    if (
      build.scanStatus !== "clean" ||
      !build.scanner?.trim() ||
      !build.scannedAt
    ) {
      return json(
        context,
        {
          error:
            "Reviewer download requires a provenance-backed clean malware scan",
        },
        422,
      );
    }

    const stored =
      await storageService.getDownloadStream(
        build.storageKey,
        request.signal,
      );
    const contentLength =
      assertBuildDownloadMetadata(stored, build);

    try {
      request.signal.throwIfAborted();
      await auditRepository.record({
        id: generateId("aud"),
        actorId: actor.id,
        actorType:
          actor.role === "admin"
            ? "admin"
            : "user",
        action:
          "build.review_artifact_download_started",
        targetId: build.id,
        targetType: "build",
        details: {
          productId: build.productId,
          version: build.version,
        },
      });
      request.signal.throwIfAborted();
    } catch (error) {
      destroyOpenedStream(stored.stream);
      throw error;
    }

    const stream =
      toDownloadWebStream(stored.stream);

    return new NextResponse(stream, {
      headers: {
        ...privateHeaders,
        "Content-Type":
          "application/octet-stream",
        "Content-Disposition":
          `attachment; filename="${reviewerAttachmentFileName(
            build.id,
            build.fileName,
          )}"`,
        "Content-Length": String(contentLength),
        "X-Content-SHA256":
          build.sha256Hash,
        "X-Content-Type-Options": "nosniff",
        [REQUEST_ID_HEADER]: context.requestId,
      },
    });
  } catch (error: unknown) {
    if (request.signal.aborted) {
      return json(
        context,
        {
          error: "Download cancelled",
          code: "DOWNLOAD_CANCELLED",
        },
        499,
      );
    }

    if (
      error instanceof BuildArtifactMismatchError
    ) {
      return json(
        context,
        {
          error:
            "Build file does not match its recorded metadata",
          code: "BUILD_ARTIFACT_MISMATCH",
        },
        409,
      );
    }

    if (error instanceof ValidationError) {
      return json(
        context,
        {
          error:
            "Resource build file is not available",
        },
        404,
      );
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
        error:
          "Could not deliver reviewer artifact",
      },
      500,
    );
  }
}
