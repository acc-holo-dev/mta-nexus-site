import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { organizationApi } from "../../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../../lib/services/organization-workspace-service";

export function GET(request: NextRequest) {
  return organizationApi(request, async (actor) => {
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    if (!(await consumeRateLimit("resourceInspection", actor.id)).success)
      throw new RateLimitExceededError();
    const values = request.nextUrl.searchParams.getAll("nonce");
    if (
      values.length !== 1 ||
      !/^[a-f0-9]{32}$/u.test(values[0] ?? "") ||
      [...request.nextUrl.searchParams.keys()].some((key) => key !== "nonce")
    )
      throw new AppError("Invalid creation nonce", 400, "VALIDATION_ERROR");
    return {
      organization: await organizationWorkspaceService.recoverCreated(
        actor.id,
        values[0] ?? "",
        request.cookies.get("nexus_session")?.value ?? "",
      ),
    };
  });
}
