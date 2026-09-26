import path from "node:path";
import { NextRequest } from "next/server";
import { z } from "zod";
import { productService } from "../../../../../lib/services/product-service";
import { buildScannerService } from "../../../../../lib/services/build-scanner-service";
import { authService } from "../../../../../lib/services/auth-service";
import { MAX_FILE_SIZE_BYTES, storageService } from "@nexus/storage";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "../../../../../lib/observability";

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const ALLOWED_BUILD_EXTENSIONS = new Set(["zip", "rar", "7z", "lua"]);
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

function hasExpectedSignature(extension: string, bytes: Uint8Array): boolean {
  if (extension === "lua") return true;
  const signature = Array.from(bytes.slice(0, 6));
  if (extension === "zip") return signature[0] === 0x50 && signature[1] === 0x4b;
  if (extension === "rar") {
    return signature[0] === 0x52 && signature[1] === 0x61 && signature[2] === 0x72 && signature[3] === 0x21;
  }
  return signature.join(",") === "55,122,188,175,39,28";
}

const buildMetadataSchema = z.object({
  version: z
    .string()
    .regex(/^v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?$/, "Semantic version expected"),
  releaseNotes: z.string().max(5000).optional(),
  mtaVersionTarget: z
    .string()
    .regex(/^1\.\d+(\.\d+)?$/, "Use an MTA version such as 1.6 or 1.6.0")
    .optional()
    .or(z.literal("")),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return privateJson(context, { error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("buildUpload", user.id);
    if (!rateLimit.success) {
      return privateJson(context, { error: "Build upload limit exceeded" }, { status: 429 });
    }

    const { id: productId } = await params;
    await productService.assertCanReleaseBuild(productId, user);

    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_FILE_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES
    ) {
      return privateJson(context, 
        { error: "Build archive exceeds the 64MB closed-beta limit" },
        { status: 413 }
      );
    }

    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return privateJson(
        context,
        { error: "Build upload requires multipart/form-data" },
        { status: 415 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const parsed = buildMetadataSchema.safeParse({
      version: form.get("version"),
      releaseNotes: form.get("releaseNotes") || undefined,
      mtaVersionTarget: form.get("mtaVersionTarget") || undefined,
    });
    if (!parsed.success || !(file instanceof File) || file.size === 0) {
      return privateJson(context, 
        { error: "A valid build archive and semantic version are required" },
        { status: 400 }
      );
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_BUILD_EXTENSIONS.has(extension)) {
      return privateJson(context, 
        { error: "Only .zip, .rar, .7z, and .lua resource builds are allowed" },
        { status: 415 }
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return privateJson(context, 
        { error: "Build archive exceeds the 64MB closed-beta limit" },
        { status: 413 }
      );
    }

    const safeFileName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFileName) {
      return privateJson(context, { error: "A valid build file name is required" }, { status: 400 });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedSignature(extension, fileBytes)) {
      return privateJson(context, 
        { error: "Build content does not match its file extension" },
        { status: 415 }
      );
    }

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
        { error: "Build was rejected by the malware scanner", scanner: scan.scanner },
        { status: 422 }
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
          error:
            "Malware scanning is temporarily unavailable. No build was stored; retry the upload later.",
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
      const build = await productService.releaseBuild(
        {
          productId,
          version: parsed.data.version.replace(/^v/, ""),
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
        },
        user
      );
      return privateJson(context, { build }, { status: 201 });
    } catch (error) {
      await storageService.deleteAsset(asset.key);
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
      return privateJson(context, 
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return privateJson(context, { error: "Could not publish build" }, { status: 500 });
  }
}
