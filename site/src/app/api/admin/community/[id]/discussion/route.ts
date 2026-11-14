import type { NextRequest } from "next/server";
import { getModeratedDiscussion } from "../../../../../../lib/moderated-discussion-api";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return getModeratedDiscussion(request, params);
}
