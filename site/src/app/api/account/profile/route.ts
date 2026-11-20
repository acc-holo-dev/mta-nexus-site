import { RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import {
  editableProfile,
  publicProfileService,
} from "../../../../lib/services/accounts/public-profile-service";
export function GET(request: NextRequest) {
  return userPlatformApi(request, async (user) => ({ profile: editableProfile(user) }));
}
export const PATCH = withBrowserMutation((request: NextRequest) => {
  return userPlatformApi(request, async (user) => {
    if (!(await consumeRateLimit("profileEditing", user.id)).success)
      throw new RateLimitExceededError();
    requireServerJsonContentType(request);
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    return {
      success: true,
      profile: await publicProfileService.update(
        await readBoundedJson(request, 16 * 1024),
        user,
        token,
      ),
    };
  });
});
