import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { profilePrivacyUpdateSchema } from "../../../../features/accounts/profile-privacy-contract";
import {
  profilePrivacyError,
  profilePrivacyMutationError,
} from "../../../../features/accounts/profile-privacy-copy";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { profilePrivacyService } from "../../../../lib/services/accounts/profile-privacy-service";

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
