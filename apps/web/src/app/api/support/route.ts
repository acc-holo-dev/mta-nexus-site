import { supportCaseRepository } from "@nexus/db";
import { can, consumeRateLimit, generateId } from "@nexus/security";
import { createSupportCaseSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { parseBoundedJson } from "../../../lib/bounded-json";
import { withBrowserMutation } from "../../../lib/browser-route-adapter";
import { createRequestLogContext } from "../../../lib/observability";
import { authService } from "../../../lib/services/auth-service";
import {
  supportFailure,
  supportMutationGuard,
  supportPrivateJson,
} from "../../../lib/support-http";
import {
  parseSupportIdempotencyKey,
  supportMutationFingerprint,
} from "../../../lib/support-idempotency";
import { supportQuery } from "../../../lib/support-workspace-contract";

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!user)
      return supportPrivateJson(
        context,
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    const filters = supportQuery(request.nextUrl.searchParams, true);
    if (!filters)
      return supportPrivateJson(
        context,
        request,
        { error: "Invalid support queue filters", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    const staff = request.nextUrl.searchParams.get("scope") === "staff";
    if (staff && !can(user, "admin.moderation"))
      return supportPrivateJson(context, request, { error: "Forbidden" }, { status: 403 });
    if (!(await consumeRateLimit("search", user.id)).success)
      return supportPrivateJson(context, request, { error: "Too many requests" }, { status: 429 });
    const selection = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.q ? { query: filters.q } : {}),
    };
    if (staff) {
      const result = await supportCaseRepository.pageStaff(filters.page, 25, selection, user.id);
      return supportPrivateJson(context, request, {
        cases: result.items.map((row) => ({
          ...row.supportCase,
          requesterUsername: row.requesterUsername,
        })),
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
      });
    }
    const result = Object.keys(selection).length
      ? await supportCaseRepository.pageByRequester(user.id, filters.page, 25, selection)
      : await supportCaseRepository.pageByRequester(user.id, filters.page);
    return supportPrivateJson(context, request, {
      cases: result.items,
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    return supportFailure(request, context, error, "support.case_list_failed");
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);

  try {
    const currentToken = request.cookies.get("nexus_session")?.value;
    const user = currentToken ? await authService.getSession(currentToken) : null;
    if (!user || !currentToken) {
      return supportPrivateJson(
        context,
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    supportMutationGuard(request);
    const body = await parseBoundedJson(request);
    if (!body.ok && body.reason === "too_large") {
      return supportPrivateJson(
        context,
        request,
        { error: "Support request body too large", code: "SUPPORT_BODY_TOO_LARGE" },
        { status: 413 },
      );
    }

    const parsed = createSupportCaseSchema.safeParse(body.ok ? body.value : null);
    if (!parsed.success) {
      return supportPrivateJson(
        context,
        request,
        { error: "Invalid support case", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const requestKey = parseSupportIdempotencyKey(request.headers.get("Idempotency-Key"));
    if (!requestKey) {
      return supportPrivateJson(
        context,
        request,
        { error: "A valid idempotency key is required", code: "SUPPORT_IDEMPOTENCY_KEY_INVALID" },
        { status: 400 },
      );
    }

    const fingerprint = supportMutationFingerprint({
      operation: "case",
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
    });
    const scope = {
      actorId: user.id,
      requestKey,
      operation: "case" as const,
      fingerprint,
    };
    const existing = await supportCaseRepository.findMutationReplay(scope, currentToken);
    if (existing.kind === "key_conflict") {
      return supportPrivateJson(
        context,
        request,
        {
          error: "Idempotency key was already used for a different request",
          code: "SUPPORT_IDEMPOTENCY_CONFLICT",
        },
        { status: 409 },
      );
    }
    if (existing.kind === "replayed") {
      return supportPrivateJson(
        context,
        request,
        { success: true, supportCase: existing.supportCase, replayed: true },
        { status: 201 },
      );
    }

    const limit = await consumeRateLimit("supportCase", user.id);
    if (!limit.success) {
      return supportPrivateJson(
        context,
        request,
        { error: "Too many support cases" },
        { status: 429 },
      );
    }

    const caseId = generateId("sup");
    const messageId = generateId("spm");
    const result = await supportCaseRepository.createIdempotentCase(
      {
        id: caseId,
        requesterId: user.id,
        category: parsed.data.category,
        subject: parsed.data.subject,
        status: "open",
      },
      {
        id: messageId,
        caseId,
        authorId: user.id,
        authorRole: "requester",
        body: parsed.data.message,
      },
      {
        id: generateId("aud"),
        actorId: user.id,
        actorType: "user",
        action: "support.case.created",
        targetId: caseId,
        targetType: "support_case",
        details: {
          category: parsed.data.category,
        },
      },
      { ...scope, caseId, messageId },
      currentToken,
    );
    if (result.kind === "key_conflict") {
      return supportPrivateJson(
        context,
        request,
        {
          error: "Idempotency key was already used for a different request",
          code: "SUPPORT_IDEMPOTENCY_CONFLICT",
        },
        { status: 409 },
      );
    }
    const supportCase = result.supportCase;
    return supportPrivateJson(
      context,
      request,
      { success: true, supportCase, replayed: result.kind === "replayed" },
      { status: 201 },
    );
  } catch (error) {
    return supportFailure(request, context, error, "support.case_create_failed");
  }
});
