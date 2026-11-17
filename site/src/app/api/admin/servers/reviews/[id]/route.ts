import { AppError } from "@nexus/domain";
import { serverReviewModerationSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { serverReviewService } from "../../../../../../lib/services/servers/server-review-service";

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    resourceCommerceRequest(request, true, async (actor) => {
      const body = serverReviewModerationSchema.safeParse(await readBoundedJson(request, 16384));
      if (!body.success) throw new AppError("Invalid moderation decision", 400, "REVIEW_INVALID");
      const result = await serverReviewService.moderate(actor, (await params).id, body.data);
      return Response.json({ success: true, ...result });
    }),
);
