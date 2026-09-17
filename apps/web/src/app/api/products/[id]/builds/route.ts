import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productService } from "../../../../../lib/services/product-service";
import { authService } from "../../../../../lib/services/auth-service";
import { MAX_FILE_SIZE_BYTES, storageService } from "@nexus/storage";
import { rateLimiter } from "@nexus/security";
import { AppError } from "@nexus/domain";

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const ALLOWED_BUILD_EXTENSIONS = new Set(["zip", "rar", "7z", "lua"]);
const BUILD_MIME_TYPES: Record<string, string> = {
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  lua: "text/plain; charset=utf-8",
};

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
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await rateLimiter.consume(`build-upload:${user.id}`, 10, 3600);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Build upload limit exceeded" }, { status: 429 });
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_FILE_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES
    ) {
      return NextResponse.json(
        { error: "Build archive exceeds the 64MB closed-beta limit" },
        { status: 413 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const parsed = buildMetadataSchema.safeParse({
      version: form.get("version"),
      releaseNotes: form.get("releaseNotes") || undefined,
    });
    if (!parsed.success || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "A valid build archive and semantic version are required" },
        { status: 400 }
      );
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_BUILD_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Only .zip, .rar, .7z, and .lua resource builds are allowed" },
        { status: 415 }
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Build archive exceeds the 64MB closed-beta limit" },
        { status: 413 }
      );
    }

    const safeFileName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFileName) {
      return NextResponse.json({ error: "A valid build file name is required" }, { status: 400 });
    }

    const { id: productId } = await params;
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedSignature(extension, fileBytes)) {
      return NextResponse.json(
        { error: "Build content does not match its file extension" },
        { status: 415 }
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
          storageKey: asset.key,
          sha256Hash: asset.sha256Hash,
          fileSizeBytes: asset.sizeBytes,
          fileName: safeFileName,
          mimeType: BUILD_MIME_TYPES[extension],
        },
        user
      );
      return NextResponse.json({ build }, { status: 201 });
    } catch (error) {
      await storageService.deleteAsset(asset.key);
      throw error;
    }
  } catch (error: unknown) {
    console.error("Build upload error:", error);
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Could not publish build" }, { status: 500 });
  }
}
