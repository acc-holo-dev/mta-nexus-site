import {
  buildRepository,
  productRepository,
  resourceDownloadAuthorizationRepository,
} from "@nexus/db";
import { AppError, ValidationError } from "@nexus/domain";
import { consumeRateLimit, generateId } from "@nexus/security";
import { storageService } from "@nexus/storage";
import { type NextRequest, NextResponse } from "next/server";
import {
  assertBuildDownloadMetadata,
  BuildArtifactMismatchError,
} from "../../../../../features/resources/build-download-metadata";
import { parseDownloadBuildSelection } from "../../../../../features/resources/build-download-selection";
import { productDownloadApiCopy } from "../../../../../features/resources/product-download-api-copy";
import { resourceAttachmentFileName } from "../../../../../features/resources/resource-attachment-filename";
import { resourceDeliveryStream } from "../../../../../features/resources/resource-delivery-stream";
import { decideResourceDownloadAccess } from "../../../../../features/resources/resource-download-policy";
import { localeAppErrorText } from "../../../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  REQUEST_ID_HEADER,
  type RequestLogContext,
} from "../../../../../lib/platform/observability";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { commerceService } from "../../../../../lib/services/commerce/commerce-service";
import { productService } from "../../../../../lib/services/commerce/product-service";
import { resourceDeliveriesService } from "../../../../../lib/services/commerce/resource-deliveries-service";

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const copy = productDownloadApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const { id: productId } = await params;
    const token = request.cookies.get("nexus_session")?.value;
    const user = token ? await authService.getSession(token) : null;

    if (!token || !user) {
      return json(
        context,
        {
          error: copy.authenticationRequired,
        },
        401,
      );
    }

    const rateLimit = await consumeRateLimit("download", user.id);
    if (!rateLimit.success) {
      return json(context, { error: copy.rate }, 429);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      return json(context, { error: copy.notFound }, 404);
    }

    const isPrivileged =
      user.role === "admin" || (await productService.canManageProduct(product, user));
    const hasEntitlement = isPrivileged
      ? false
      : await commerceService.checkEntitlement(
          { type: "user", id: user.id },
          productId,
          "product.download",
        );
    const access = decideResourceDownloadAccess(product, isPrivileged, hasEntitlement);

    if (!access.allowed) {
      if (access.reason === "resource_not_published") {
        return json(context, { error: copy.notFound }, 404);
      }
      return json(
        context,
        {
          error: copy.libraryRequired,
        },
        403,
      );
    }

    const selection = parseDownloadBuildSelection(request.nextUrl.searchParams);
    if (selection.kind === "invalid") {
      return json(context, { error: copy.invalidBuild, code: "BUILD_ID_INVALID" }, 400);
    }
    const selectedBuild =
      selection.kind === "pinned"
        ? await buildRepository.findPublishedByProductAndId(productId, selection.buildId)
        : await buildRepository.findLatestPublishedByProduct(productId);
    if (!selectedBuild) {
      return json(
        context,
        {
          error: copy.noPublishedBuild,
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
          error: copy.notCleared,
        },
        409,
      );
    }

    const stored = await storageService.getDownloadStream(selectedBuild.storageKey, request.signal);
    const contentLength = assertBuildDownloadMetadata(stored, selectedBuild);

    let authorized: { slug: string; receiptId: string } | undefined;
    const recordFailure = (error: unknown) =>
      logRequestEvent({
        level: "error",
        event: "product.download_receipt_failed",
        context,
        error,
      });
    try {
      request.signal.throwIfAborted();
      authorized = await resourceDownloadAuthorizationRepository.authorize({
        auditId: generateId("aud"),
        receiptId: generateId("dlv"),
        actorId: user.id,
        currentToken: token,
        expected: selectedBuild,
        pinned: selection.kind === "pinned",
      });
      request.signal.throwIfAborted();
    } catch (error) {
      destroyOpenedStream(stored.stream);
      if (authorized)
        await resourceDeliveriesService
          .finish(user.id, authorized.receiptId, {
            status: "cancelled",
            bytesSent: 0,
            errorCode: null,
          })
          .catch(recordFailure);
      throw error;
    }

    const receiptId = authorized.receiptId;
    const stream = resourceDeliveryStream({
      source: stored.stream,
      expectedBytes: contentLength,
      sha256Hash: selectedBuild.sha256Hash,
      signal: request.signal,
      finish: (result) => resourceDeliveriesService.finish(user.id, receiptId, result),
      recordFailure,
    });
    const fileName = resourceAttachmentFileName(
      authorized.slug,
      selectedBuild.version,
      selectedBuild.fileName,
    );

    return new NextResponse(stream, {
      headers: {
        "Content-Type":
          selectedBuild.mimeType || stored.meta?.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(contentLength),
        "X-Content-SHA256": selectedBuild.sha256Hash,
        "X-Resource-Build-Id": selectedBuild.id,
        "X-Resource-Delivery-Id": authorized.receiptId,
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

    if (error instanceof AppError)
      return json(
        context,
        {
          error: localeAppErrorText(
            error,
            {
              unauthorized: copy.authenticationRequired,
              forbidden: copy.forbidden,
              notFound: copy.notFound,
              failed: copy.deliverFailed,
            },
            {
              BUILD_ID_INVALID: copy.invalidBuild,
              LIBRARY_REQUIRED: copy.libraryRequired,
              NO_PUBLISHED_BUILD: copy.noPublishedBuild,
              BUILD_NOT_CLEARED: copy.notCleared,
              DOWNLOAD_CANCELLED: copy.cancelled,
            },
          ),
          code: error.code,
        },
        error.statusCode,
      );

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
        error: copy.deliverFailed,
      },
      500,
    );
  }
}
