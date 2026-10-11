import type { NextRequest } from "next/server";
import { AppError, NotFoundError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { parseContentPage, writerTypes } from "./user-platform-contract";
export function organizationContentId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) throw new NotFoundError("Content");
  return id;
}
export function organizationContentFilters(request: NextRequest, detail = false) {
  const params = request.nextUrl.searchParams;
  if (
    [...params.keys()].some(
      (key) =>
        detail || !["q", "page", "status", "type"].includes(key) || params.getAll(key).length !== 1,
    ) ||
    (params.has("page") && !/^[1-9]\d{0,3}$/u.test(params.get("page") ?? "")) ||
    (params.has("q") && (params.get("q")?.length ?? 0) > 120) ||
    (params.has("status") &&
      !["all", "draft", "published", "archived"].includes(params.get("status") ?? "")) ||
    (params.has("type") &&
      params.get("type") !== "all" &&
      !writerTypes.some((type) => type === params.get("type")))
  )
    throw new AppError("Invalid publication filters", 400, "VALIDATION_FAILED");
  return parseContentPage(params);
}
export async function organizationContentRate(
  actorId: string,
  kind: "search" | "contentCreation" | "contentEditing",
) {
  if (!(await consumeRateLimit(kind, actorId)).success) throw new RateLimitExceededError();
}
