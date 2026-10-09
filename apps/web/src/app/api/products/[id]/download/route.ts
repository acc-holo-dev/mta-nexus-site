import { resourceAttachmentFileName } from "../../../../../lib/resource-attachment-filename";
import { ValidationError } from "@nexus/domain";
import {
  auditRepository,
  buildRepository,
  productRepository,
} from "@nexus/db";
import { consumeRateLimit, generateId } from "@nexus/security";
import { storageService } from "@nexus/storage";
import { type NextRequest, NextResponse } from "next/server";
import { parseDownloadBuildSelection } from "../../../../../lib/build-download-selection";
import {
  assertBuildDownloadMetadata,
  BuildArtifactMismatchError,
} from "../../../../../lib/build-download-metadata";
import { toDownloadWebStream } from "../../../../../lib/download-web-stream";
import {
  REQUEST_ID_HEADER,
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../lib/observability";
import { decideResourceDownloadAccess } from "../../../../../lib/resource-download-policy";
import { authService } from "../../../../../lib/services/auth-service";
import { commerceService } from "../../../../../lib/services/commerce-service";
import { productService } from "../../../../../lib/services/product-service";

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
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);

  try {
    const { id: productId } = await params;
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(
        context,
        {
          error:
            "Authentication required to download resource builds",
        },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "download",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        { error: "Too many download requests" },
        429,
      );
    }

    const product =
      await productRepository.findById(productId);
    if (!product) {
      return json(
        context,
        { error: "Resource not found" },
        404,
      );
    }

    const isPrivileged =
      user.role === "admin" ||
      (await productService.canManageProduct(
        product,
        user,
      ));
    const hasEntitlement = isPrivileged
      ? false
      : await commerceService.checkEntitlement(
          { type: "user", id: user.id },
          productId,
          "product.download",
        );
    const access = decideResourceDownloadAccess(
      product,
      isPrivileged,
      hasEntitlement,
    );

    if (!access.allowed) {
      if (
        access.reason ===
        "resource_not_published"
      ) {
        return json(
          context,
          { error: "Resource not found" },
          404,
        );
      }
      return json(
        context,
        {
          error:
            "Add this resource to your library before downloading it",
        },
        403,
      );
    }

    const selection = parseDownloadBuildSelection(request.nextUrl.searchParams);
    if (selection.kind === "invalid") {
      return json(
        context,
        { error: "Invalid requested build", code: "BUILD_ID_INVALID" },
        400,
      );
    }
    const selectedBuild = selection.kind === "pinned"
      ? await buildRepository.findPublishedByProductAndId(productId, selection.buildId)
      : await buildRepository.findLatestPublishedByProduct(productId);
    if (!selectedBuild) {
      return json(
        context,
        {
          error:
            "No published build is available",
        },
        404,
      );
    }

    if (
      selectedBuild.scanStatus !== "clean" ||
      !selectedBuild.scanner?.trim() ||
      !selectedBuild.scannedAt
    ) {
      return json(
        context,
        {
          error:
            "Published build is not cleared for delivery",
        },
        409,
      );
    }

    const stored =
      await storageService.getDownloadStream(
        selectedBuild.storageKey,
        request.signal,
      );
    const contentLength =
      assertBuildDownloadMetadata(
        stored,
        selectedBuild,
      );

    try {
      request.signal.throwIfAborted();
      await auditRepository.record({
        id: generateId("aud"),
        actorId: user.id,
        actorType: "user",
        action: "product.download_started",
        targetId: productId,
        targetType: "product",
        details: {
          buildId: selectedBuild.id,
          version: selectedBuild.version,
          pinned: selection.kind === "pinned",
        },
      });
      request.signal.throwIfAborted();
    } catch (error) {
      destroyOpenedStream(stored.stream);
      throw error;
    }

    const stream =
      toDownloadWebStream(stored.stream);
    const fileName = resourceAttachmentFileName(
      product.slug,
      selectedBuild.version,
      selectedBuild.fileName,
    );

    return new NextResponse(stream, {
      headers: {
        "Content-Type":
          selectedBuild.mimeType ||
          stored.meta?.mimeType ||
          "application/octet-stream",
        "Content-Disposition":
          `attachment; filename="${fileName}"`,
        "Content-Length": String(contentLength),
        "X-Content-SHA256":
          selectedBuild.sha256Hash,
        "X-Resource-Build-Id": selectedBuild.id,
        ...privateHeaders,
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
      event: "product.download_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Failed to deliver resource build",
      },
      500,
    );
  }
}
