import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import {
  getModeratedDiscussion,
  removeModeratedDiscussion,
} from "../../../../../../../lib/moderated-discussion-api";

type Context = { params: Promise<{ id: string; commentId: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return getModeratedDiscussion(request, params);
}
export const POST = withBrowserMutation((request: NextRequest, { params }: Context) => {
  return removeModeratedDiscussion(request, params);
});
