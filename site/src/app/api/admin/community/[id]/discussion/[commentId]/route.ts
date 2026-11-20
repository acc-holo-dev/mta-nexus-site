import type { NextRequest } from "next/server";
import {
  getModeratedDiscussion,
  removeModeratedDiscussion,
} from "../../../../../../../features/community/moderated-discussion-api";
import { withBrowserMutation } from "../../../../../../../lib/http/browser-route-adapter";

type Context = { params: Promise<{ id: string; commentId: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return getModeratedDiscussion(request, params);
}
export const POST = withBrowserMutation((request: NextRequest, { params }: Context) => {
  return removeModeratedDiscussion(request, params);
});
