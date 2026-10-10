import type { NextRequest } from "next/server";
import type { User } from "@nexus/domain";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "./user-platform-api";
import { organizationError } from "./organization-workspace-copy";
import { readBoundedJson, requireServerJsonContentType } from "./bounded-json";
export function organizationApi(
  request: NextRequest,
  action: (user: User) => Promise<unknown>,
  status = 200,
) {
  return userPlatformApi(request, action, status, organizationError);
}
export function organizationId(id: string) {
  if (!id || id.length > 128) throw new AppError("Invalid identifier", 404, "NOT_FOUND");
  return id;
}
export async function organizationInput(request: NextRequest, user: User, creation = false) {
  if (
    !(await consumeRateLimit(creation ? "organizationCreation" : "organizationManagement", user.id))
      .success
  )
    throw new RateLimitExceededError();
  requireServerJsonContentType(request);
  return readBoundedJson(request, 32 * 1024);
}
