import { AppError } from "@nexus/domain";
import { resourceQaRemoveAnswerSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../../../../../lib/resource-commerce-http";
import { resourceQaService } from "../../../../../../../../../lib/services/resource-qa-service";

export const POST = withBrowserMutation(
  (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; threadId: string; answerId: string }> },
  ) =>
    resourceCommerceRequest(request, true, async (actor) => {
      const body = resourceQaRemoveAnswerSchema.safeParse(await readBoundedJson(request, 4096));
      if (!body.success) throw new AppError("Invalid Q&A command", 400, "RESOURCE_QA_INVALID");
      const { id, threadId, answerId } = await params;
      const result = await resourceQaService.removeAnswer(actor, id, threadId, answerId, body.data);
      return Response.json({ success: true, ...result });
    }),
);
