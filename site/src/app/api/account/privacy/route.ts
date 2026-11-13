import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { profilePrivacyUpdateSchema } from "../../../../lib/profile-privacy-contract";
import {
  profilePrivacyError,
  profilePrivacyMutationError,
} from "../../../../lib/profile-privacy-copy";
import { profilePrivacyService } from "../../../../lib/services/profile-privacy-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";

export const dynamic = "force-dynamic";
const validQuery = (request: NextRequest) => {
  if (request.nextUrl.searchParams.size)
    throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
};
export function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      validQuery(request);
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return { preferences: await profilePrivacyService.own(actor) };
    },
    200,
    profilePrivacyError,
  );
}
export const PATCH = withBrowserMutation((request: NextRequest) => {
  return userPlatformApi(
    request,
    async (actor) => {
      validQuery(request);
      requireServerJsonContentType(request);
      const parsed = profilePrivacyUpdateSchema.safeParse(await readBoundedJson(request, 4096));
      if (!parsed.success) throw new AppError("Invalid visibility", 400, "VALIDATION_ERROR");
      if (parsed.data.expectedActorId !== actor.id)
        throw new AppError("Account changed", 409, "ACCOUNT_CHANGED");
      if (!(await consumeRateLimit("profileEditing", actor.id)).success)
        throw new RateLimitExceededError();
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      return {
        success: true,
        preferences: await profilePrivacyService.update(actor, parsed.data, currentToken),
      };
    },
    200,
    profilePrivacyMutationError,
  );
});
