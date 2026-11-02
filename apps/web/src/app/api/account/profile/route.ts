import { RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import {
  editableProfile,
  publicProfileService,
} from "../../../../lib/services/public-profile-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
export function GET(request: NextRequest) {
  return userPlatformApi(request, async (user) => ({ profile: editableProfile(user) }));
}
export const PATCH = withBrowserMutation((request: NextRequest) => {
  return userPlatformApi(request, async (user) => {
    if (!(await consumeRateLimit("profileEditing", user.id)).success)
      throw new RateLimitExceededError();
    requireServerJsonContentType(request);
    return {
      success: true,
      profile: await publicProfileService.update(await readBoundedJson(request, 16 * 1024), user),
    };
  });
});
