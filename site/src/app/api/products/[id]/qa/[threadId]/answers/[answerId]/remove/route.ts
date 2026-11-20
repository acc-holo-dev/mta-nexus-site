import { AppError } from "@nexus/domain";
import { resourceQaRemoveAnswerSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../../../../lib/http/browser-route-adapter";
import { resourceQaService } from "../../../../../../../../../lib/services/resources/resource-qa-service";

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
