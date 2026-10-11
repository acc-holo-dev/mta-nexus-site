import type { NextRequest } from "next/server";
import {
  getModeratedDiscussion,
  removeModeratedDiscussion,
} from "../../../../../../../lib/moderated-discussion-api";

type Context = { params: Promise<{ id: string; commentId: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return getModeratedDiscussion(request, params);
}
export function POST(request: NextRequest, { params }: Context) {
  return removeModeratedDiscussion(request, params);
}
