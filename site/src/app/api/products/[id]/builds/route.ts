import path from "node:path";
import { AppError, MAX_BUILD_MULTIPART_OVERHEAD_BYTES } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { MAX_FILE_SIZE_BYTES, storageService } from "@nexus/storage";
import { mtaVersionSchema, resourceVersionSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSupportedBuildExtension,
  hasExpectedBuildFileFormat,
} from "../../../../../features/resources/build-file-validation";
import { productBuildsApiCopy } from "../../../../../features/resources/product-builds-api-copy";
import {
  MultipartBodyTooLargeError,
  parseMultipartFormDataWithLimit,
} from "../../../../../lib/http/bounded-multipart";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/platform/observability";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { productService } from "../../../../../lib/services/commerce/product-service";
import { inspectBuildPackage } from "../../../../../lib/services/resources/build-package-inspection";
import { buildScannerService } from "../../../../../lib/services/resources/build-scanner-service";

const BUILD_FILE_SIZE_LIMIT_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
const BUILD_MIME_TYPES: Record<string, string> = {
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  lua: "text/plain; charset=utf-8",
};

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function privateJson(
  context: ReturnType<typeof createRequestLogContext>,
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(privateHeaders);
  new Headers(init.headers).forEach((value, key) => {
    headers.set(key, value);
  });
  return jsonWithRequestId(context, body, {
    ...init,
    headers,
  });
}

const buildMetadataSchema = z.object({
  version: resourceVersionSchema,
  releaseNotes: z.string().max(5000).optional(),
  mtaVersionTarget: mtaVersionSchema.optional().or(z.literal("")),
});

export const POST = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = createRequestLogContext(request);
    const copy = productBuildsApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
    try {
      const token = request.cookies.get("nexus_session")?.value;
      const user = token ? await authService.getSession(token) : null;
      if (!token || !user) {
        return privateJson(
          context,
          { error: copy.authenticationRequired, code: "UNAUTHORIZED" },
          { status: 401 },
        );
      }

      const expectedActor = request.headers.get("x-nexus-actor-id");
      if (!expectedActor)
        return privateJson(
          context,
          { error: copy.actorRequired, code: "ACTOR_ID_REQUIRED" },
          { status: 428 },
        );
      if (expectedActor !== user.id)
        return privateJson(
          context,
          { error: copy.actorChanged, code: "ACTOR_CHANGED" },
          { status: 409 },
        );
      const rateLimit = await consumeRateLimit("buildUpload", user.id);
      if (!rateLimit.success) {
        return privateJson(
          context,
          { error: copy.rate, code: "RATE_LIMIT_EXCEEDED" },
          { status: 429 },
        );
      }

      const { id: productId } = await params;
      await productService.assertCanReleaseBuild(productId, user);

      const declaredLength = Number(request.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_FILE_SIZE_BYTES + MAX_BUILD_MULTIPART_OVERHEAD_BYTES
      ) {
        return privateJson(
          context,
          {
            error: copy.archiveTooLarge(BUILD_FILE_SIZE_LIMIT_MB),
            code: "BUILD_UPLOAD_TOO_LARGE",
          },
          { status: 413 },
        );
      }

      const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.startsWith("multipart/form-data")) {
        return privateJson(
          context,
          {
            error: copy.multipartRequired,
            code: "BUILD_MULTIPART_REQUIRED",
          },
          { status: 415 },
        );
      }

      let form: FormData;
      try {
        form = await parseMultipartFormDataWithLimit(
          request,
          MAX_FILE_SIZE_BYTES + MAX_BUILD_MULTIPART_OVERHEAD_BYTES,
        );
      } catch (error) {
        if (error instanceof MultipartBodyTooLargeError) {
          return privateJson(
            context,
            {
              error: copy.archiveTooLarge(BUILD_FILE_SIZE_LIMIT_MB),
              code: "BUILD_UPLOAD_TOO_LARGE",
            },
            { status: 413 },
          );
        }
        return privateJson(
          context,
          {
            error: copy.multipartInvalid,
            code: "BUILD_MULTIPART_INVALID",
          },
          { status: 400 },
        );
      }
      const file = form.get("file");
      const parsed = buildMetadataSchema.safeParse({
        version: form.get("version"),
        releaseNotes: form.get("releaseNotes") || undefined,
        mtaVersionTarget: form.get("mtaVersionTarget") || undefined,
      });
      if (!parsed.success || !(file instanceof File) || file.size === 0) {
        return privateJson(
          context,
          {
            error: copy.metadataInvalid,
            code: "BUILD_METADATA_INVALID",
          },
          { status: 400 },
        );
      }
      const extension = getSupportedBuildExtension(file.name);
      if (!extension) {
        return privateJson(
          context,
          {
            error: copy.fileTypeNotAllowed,
            code: "BUILD_FILE_TYPE_NOT_ALLOWED",
          },
          { status: 415 },
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return privateJson(
          context,
          {
            error: copy.archiveTooLarge(BUILD_FILE_SIZE_LIMIT_MB),
            code: "BUILD_UPLOAD_TOO_LARGE",
          },
          { status: 413 },
        );
      }

      const safeFileName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safeFileName) {
        return privateJson(
          context,
          { error: copy.fileNameInvalid, code: "BUILD_FILE_NAME_INVALID" },
          { status: 400 },
        );
      }

      const fileBytes = new Uint8Array(await file.arrayBuffer());
      if (!hasExpectedBuildFileFormat(extension, fileBytes)) {
        return privateJson(
          context,
          {
            error: copy.contentMismatch,
            code: "BUILD_CONTENT_MISMATCH",
          },
          { status: 415 },
        );
      }

      const packageEvidence = await inspectBuildPackage({
        bytes: fileBytes,
        format: extension,
        signal: request.signal,
      });
      const scan = await buildScannerService.scan({ bytes: fileBytes, fileName: safeFileName });
      if (scan.status === "malicious") {
        logRequestEvent({
          level: "warn",
          event: "resource.build.rejected_malware",
          context,
          status: 422,
          fields: { scanner: scan.scanner },
        });
        return privateJson(
          context,
          {
            error: copy.malwareDetected,
            code: "BUILD_MALWARE_DETECTED",
            scanner: scan.scanner,
          },
          { status: 422 },
        );
      }
      if (scan.status === "rejected") {
        logRequestEvent({
          level: "warn",
          event: "resource.build.rejected_scan_limits",
          context,
          status: 422,
          fields: { scanner: scan.scanner },
        });
        return privateJson(
          context,
          {
            error: copy.scanLimitExceeded,
            code: "BUILD_SCAN_LIMIT_EXCEEDED",
            scanner: scan.scanner,
          },
          { status: 422 },
        );
      }
      if (scan.status === "error") {
        logRequestEvent({
          level: "warn",
          event: "resource.build.scanner_unavailable",
          context,
          status: 503,
          fields: { scanner: scan.scanner },
        });
        return privateJson(
          context,
          {
            error: copy.scannerUnavailable,
            code: "BUILD_SCANNER_UNAVAILABLE",
          },
          { status: 503, headers: { "Retry-After": "30" } },
        );
      }

      const asset = await storageService.uploadAsset({
        data: fileBytes,
        fileName: safeFileName,
        mimeType: BUILD_MIME_TYPES[extension],
        userId: user.id,
        isPrivate: true,
      });

      try {
        if (
          asset.sha256Hash !== packageEvidence.sha256Hash ||
          asset.sizeBytes !== packageEvidence.fileSizeBytes
        )
          throw new AppError(
            "Stored artifact does not match inspected bytes",
            503,
            "BUILD_PACKAGE_IDENTITY_CONFLICT",
          );
        const build = await productService.releaseBuild(
          {
            productId,
            version: parsed.data.version,
            releaseNotes: parsed.data.releaseNotes,
            mtaVersionTarget: parsed.data.mtaVersionTarget || undefined,
            storageKey: asset.key,
            sha256Hash: asset.sha256Hash,
            fileSizeBytes: asset.sizeBytes,
            fileName: safeFileName,
            mimeType: BUILD_MIME_TYPES[extension],
            scanStatus: scan.status,
            scanner: scan.scanner,
            scannedAt: scan.scannedAt,
            packageEvidence,
          },
          user,
          token,
        );
        return privateJson(context, { build }, { status: 201 });
      } catch (error) {
        await storageService.deleteAsset(asset.key);
        if (error instanceof AppError && error.code === "BUILD_VERSION_EXISTS") {
          const build = await productService.recoverPendingBuildUpload(
            {
              productId,
              version: parsed.data.version,
              releaseNotes: parsed.data.releaseNotes,
              mtaVersionTarget: parsed.data.mtaVersionTarget || undefined,
              sha256Hash: asset.sha256Hash,
              fileSizeBytes: asset.sizeBytes,
              fileName: safeFileName,
              mimeType: BUILD_MIME_TYPES[extension],
            },
            user,
          );
          if (build) {
            return privateJson(
              context,
              {
                build: {
                  id: build.id,
                  productId: build.productId,
                  version: build.version,
                  status: build.status,
                },
                reusedBuild: true,
              },
              { status: 200 },
            );
          }
        }
        throw error;
      }
    } catch (error: unknown) {
      if (!(error instanceof AppError)) {
        logRequestEvent({
          level: "error",
          event: "resource.build.upload_failed",
          context,
          status: 500,
          error,
        });
      }
      if (error instanceof AppError) {
        return privateJson(
          context,
          {
            error: localeAppErrorText(
              error,
              {
                unauthorized: copy.authenticationRequired,
                forbidden: copy.forbidden,
                notFound: copy.notFound,
                conflict: copy.actorChanged,
                unsupportedMediaType: copy.unsupportedMediaType,
                requestBodyTooLarge: copy.requestBodyTooLarge,
                invalidBodyLength: copy.invalidBodyLength,
                requestBodyTimeout: copy.requestBodyTimeout,
                failed: copy.publishFailed,
              },
              {
                ACTOR_REQUIRED: copy.actorRequired,
                BUILD_PACKAGE_INSPECTOR_BUSY: copy.inspectorBusy,
                MALWARE_DETECTED: copy.malwareDetected,
                SCAN_LIMIT_EXCEEDED: copy.scanLimitExceeded,
                SCANNER_UNAVAILABLE: copy.scannerUnavailable,
                FILE_TYPE_NOT_ALLOWED: copy.fileTypeNotAllowed,
                CONTENT_MISMATCH: copy.contentMismatch,
              },
            ),
            code: error.code,
          },
          {
            status: error.statusCode,
            ...(error.code === "BUILD_PACKAGE_INSPECTOR_BUSY"
              ? { headers: { "Retry-After": "5" } }
              : {}),
          },
        );
      }
      return privateJson(context, { error: copy.publishFailed }, { status: 500 });
    }
  },
);
