import type { NextRequest } from "next/server";
import { resourceMediaImage } from "../../../../lib/resource-media-image-http";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
  return resourceMediaImage(request, (await context.params).mediaId);
}
