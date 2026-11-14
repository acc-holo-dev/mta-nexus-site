import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { resourceMediaRepository } from "@nexus/db";
import { AppError, RESOURCE_MEDIA_OUTPUT_BYTES } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { storageService } from "@nexus/storage";
import { resourceMediaIdSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";
import { getTrustedRequestIp } from "./request-client-ip";
import { authService } from "./services/auth-service";

let activeReads = 0;
export async function resourceMediaImage(request: NextRequest, mediaId: string) {
  const context = createRequestLogContext(request);
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Request-Id": context.requestId,
  };
  let stream: Readable | undefined;
  let acquired = false;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
  try {
    if (!resourceMediaIdSchema.safeParse(mediaId).success)
      throw new AppError("Missing image", 404, "NOT_FOUND");
    if (
      !(
        await consumeRateLimit(
          "resourceInspection",
          `resource-media:${getTrustedRequestIp(request)}`,
        )
      ).success
    )
      throw new AppError("Rate limited", 429, "RATE_LIMIT_EXCEEDED");
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    const image = await resourceMediaRepository.authorizeImage(mediaId, actor?.id);
    if (activeReads >= 4) throw new AppError("Image delivery is busy", 503, "RESOURCE_MEDIA_BUSY");
    activeReads++;
    acquired = true;
    const opened = await storageService.getDownloadStream(image.storageKey, signal);
    if (!(opened.stream instanceof Readable)) {
      (opened.stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
      throw new AppError("Image storage unavailable", 503, "RESOURCE_MEDIA_UNAVAILABLE");
    }
    stream = opened.stream;
    if (
      opened.meta.sha256Hash !== image.sha256Hash ||
      opened.meta.sizeBytes !== image.fileSizeBytes ||
      image.fileSizeBytes > RESOURCE_MEDIA_OUTPUT_BYTES
    )
      throw new AppError("Image identity changed", 503, "RESOURCE_MEDIA_UNAVAILABLE");
    const chunks: Buffer[] = [];
    let length = 0;
    const hash = createHash("sha256");
    const cancel = () => stream?.destroy(new Error("Image request cancelled"));
    signal.addEventListener("abort", cancel, { once: true });
    try {
      signal.throwIfAborted();
      for await (const raw of stream) {
        signal.throwIfAborted();
        if (!(raw instanceof Uint8Array)) throw new Error("Invalid image stream");
        const chunk = Buffer.from(raw);
        length += chunk.length;
        if (length > image.fileSizeBytes || length > RESOURCE_MEDIA_OUTPUT_BYTES)
          throw new Error("Invalid image length");
        hash.update(chunk);
        chunks.push(chunk);
      }
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    if (length !== image.fileSizeBytes || hash.digest("hex") !== image.sha256Hash)
      throw new Error("Invalid image bytes");
    return new Response(new Uint8Array(Buffer.concat(chunks, length)), {
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "Content-Length": String(length),
        "Content-Disposition": 'inline; filename="resource-preview.png"',
      },
    });
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 503;
    if (!(error instanceof AppError))
      logRequestEvent({ level: "error", event: "resource.image_failed", context, status, error });
    return jsonWithRequestId(
      context,
      { code: error instanceof AppError ? error.code : "RESOURCE_MEDIA_UNAVAILABLE" },
      { status, headers: { ...headers, ...(status === 503 ? { "Retry-After": "5" } : {}) } },
    );
  } finally {
    stream?.destroy();
    if (acquired) activeReads--;
  }
}
