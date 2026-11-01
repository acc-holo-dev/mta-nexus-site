import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceQaAnswerSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { resourceQaService } from "../../../../../../../lib/services/resource-qa-service";

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) =>
    resourceCommerceRequest(request, true, async (actor) => {
      const body = resourceQaAnswerSchema.safeParse(await readBoundedJson(request, 16384));
      if (!body.success) throw new AppError("Invalid Q&A command", 400, "RESOURCE_QA_INVALID");
      const { id, threadId } = await params;
      const result = await resourceQaService.answer(actor, id, threadId, {
        action: "answer",
        ...body.data,
      });
      return Response.json({ success: true, ...result }, { status: 201 });
    }),
);
