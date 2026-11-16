import type { NextRequest } from "next/server";
import type { User } from "@nexus/domain";
import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
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
export function organizationMutationToken(request: NextRequest, user: User) {
  const expected = request.headers.get("x-nexus-actor-id");
  if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
  if (expected !== user.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
  const token = request.cookies.get("nexus_session")?.value;
  if (!token) throw new UnauthorizedError();
  return token;
}
export function organizationCheckReadActor(request: NextRequest, user: User) {
  const expected = request.headers.get("x-nexus-actor-id");
  if (expected !== null && expected !== user.id)
    throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
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
