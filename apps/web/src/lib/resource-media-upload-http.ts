import { AppError, RESOURCE_MEDIA_INPUT_BYTES, RESOURCE_MEDIA_LIMIT } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { resourceMediaCaptionSchema, resourceMediaRevisionSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { MultipartBodyTooLargeError, parseMultipartFormDataWithLimit } from "./bounded-multipart";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";
import { authService } from "./services/auth-service";
import { resourceMediaService } from "./services/resource-media-service";
export async function resourceMediaUpload(request: NextRequest, productId: string) {
  const context = createRequestLogContext(request);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        ...(status === 503 ? { "Retry-After": "5" } : {}),
      },
    });
  try {
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!actor) throw new AppError("Sign in", 401, "UNAUTHORIZED");
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new AppError("Cross-site upload", 403, "FORBIDDEN");
    if (!/^multipart\/form-data\s*;/iu.test(request.headers.get("content-type") ?? ""))
      throw new AppError("Multipart image required", 415, "UNSUPPORTED_MEDIA_TYPE");
    if (!(await consumeRateLimit("contentCreation", actor.id)).success)
      throw new AppError("Rate limited", 429, "RATE_LIMIT_EXCEEDED");
    // Reject unauthorized/read-only/full galleries before parsing retained file bytes.
    const current = await resourceMediaService.managed(productId, actor.id);
    if (["archived", "suspended"].includes(current.product.status))
      throw new AppError("Read-only gallery", 409, "PRODUCT_STATE_CHANGED");
    if (current.items.length >= RESOURCE_MEDIA_LIMIT)
      throw new AppError("Gallery limit", 422, "RESOURCE_MEDIA_LIMIT");
    const limit = RESOURCE_MEDIA_INPUT_BYTES + 64 * 1024;
    const length = request.headers.get("content-length");
    if (
      length !== null &&
      (!/^(?:0|[1-9][0-9]*)$/u.test(length) || !Number.isSafeInteger(Number(length)))
    )
      throw new AppError("Invalid length", 400, "INVALID_BODY_LENGTH");
    if (length !== null && Number(length) > limit) throw new MultipartBodyTooLargeError();
    const form = await parseMultipartFormDataWithLimit(request, limit);
    if (
      [...form.keys()].some((key) => !["file", "caption", "expectedUpdatedAt"].includes(key)) ||
      ["file", "caption", "expectedUpdatedAt"].some((key) => form.getAll(key).length !== 1)
    )
      throw new AppError("Invalid image fields", 400, "RESOURCE_MEDIA_INVALID");
    const file = form.get("file"),
      caption = resourceMediaCaptionSchema.safeParse(form.get("caption")),
      revision = resourceMediaRevisionSchema.safeParse(form.get("expectedUpdatedAt"));
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > RESOURCE_MEDIA_INPUT_BYTES ||
      !caption.success ||
      !revision.success
    )
      throw new AppError("Invalid image fields", 422, "RESOURCE_MEDIA_INVALID");
    if (revision.data !== current.product.updatedAt)
      throw new AppError("Gallery changed", 409, "RESOURCE_MEDIA_CONFLICT");
    return respond(
      await resourceMediaService.upload({
        productId,
        actorId: actor.id,
        caption: caption.data,
        expectedUpdatedAt: revision.data,
        bytes: Buffer.from(await file.arrayBuffer()),
        signal: request.signal,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof MultipartBodyTooLargeError)
      return respond({ code: "RESOURCE_MEDIA_LIMIT" }, 413);
    if (error instanceof AppError) return respond({ code: error.code }, error.statusCode);
    logRequestEvent({
      level: "error",
      event: "resource.media_upload_failed",
      context,
      status: 503,
      error,
    });
    return respond({ code: "RESOURCE_MEDIA_UNAVAILABLE" }, 503);
  }
}
