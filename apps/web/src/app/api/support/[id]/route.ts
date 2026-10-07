import { supportCaseRepository } from "@nexus/db";
import { generateId, can, consumeRateLimit } from "@nexus/security";
import {
  createSupportMessageSchema,
  updateSupportCaseStatusSchema,
} from "@nexus/validation";
import type { NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";

function privateJson(
  context: Parameters<typeof jsonWithRequestId>[0],
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie");
  return jsonWithRequestId(context, body, { ...init, headers });
}

async function loadAuthorizedCase(request: NextRequest, id: string) {
  const user = await authService.getSession(
    request.cookies.get("nexus_session")?.value,
  );
  if (!user) return { user: null, supportCase: null, staff: false };

  const supportCase = await supportCaseRepository.findById(id);
  if (!supportCase) return { user, supportCase: null, staff: false };

  const staff = can(user, "admin.moderation");
  if (supportCase.requesterId !== user.id && !staff) {
    return { user, supportCase: null, staff: false };
  }

  return { user, supportCase, staff };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);

  try {
    const { id } = await params;
    if (!/^sup_[a-f0-9]{24}$/.test(id)) {
      return privateJson(
        context,
        { error: "Support case not found" },
        { status: 404 },
      );
    }

    const access = await loadAuthorizedCase(request, id);
    if (!access.user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!access.supportCase) {
      return privateJson(
        context,
        { error: "Support case not found" },
        { status: 404 },
      );
    }

    return privateJson(context, {
      supportCase: access.supportCase,
      messages: await supportCaseRepository.listMessages(id),
      staff: access.staff,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "support.case_read_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Could not load support case" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);

  try {
    const { id } = await params;
    const access = await loadAuthorizedCase(request, id);
    if (!access.user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!access.supportCase) {
      return privateJson(
        context,
        { error: "Support case not found" },
        { status: 404 },
      );
    }

    const limit = await consumeRateLimit("supportMessage", access.user.id);
    if (!limit.success) {
      return privateJson(
        context,
        { error: "Too many support messages" },
        { status: 429 },
      );
    }

    const parsed = createSupportMessageSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        { error: "Invalid support message" },
        { status: 400 },
      );
    }

    const authorRole =
      access.supportCase.requesterId === access.user.id
        ? "requester"
        : "staff";
    const result = await supportCaseRepository.addMessage(
      {
        id: generateId("spm"),
        caseId: id,
        authorId: access.user.id,
        authorRole,
        body: parsed.data.message,
      },
      {
        id: generateId("aud"),
        actorId: access.user.id,
        actorType: authorRole === "staff" ? "admin" : "user",
        action: "support.message.created",
        targetId: id,
        targetType: "support_case",
        details: { authorRole },
      },
    );

    if (!result) {
      return privateJson(
        context,
        { error: "Closed support cases cannot receive new messages" },
        { status: 409 },
      );
    }

    return privateJson(
      context,
      { success: true, ...result },
      { status: 201 },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "support.message_create_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Could not add support message" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);

  try {
    const { id } = await params;
    const access = await loadAuthorizedCase(request, id);
    if (!access.user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!access.supportCase) {
      return privateJson(
        context,
        { error: "Support case not found" },
        { status: 404 },
      );
    }
    if (!access.staff) {
      return privateJson(context, { error: "Forbidden" }, { status: 403 });
    }

    const parsed = updateSupportCaseStatusSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        { error: "Invalid support status" },
        { status: 400 },
      );
    }

    const supportCase = await supportCaseRepository.updateStatus(
      id,
      parsed.data.status,
      {
        id: generateId("aud"),
        actorId: access.user.id,
        actorType: "admin",
        action: "support.case.status_changed",
        targetId: id,
        targetType: "support_case",
        details: {
          from: access.supportCase.status,
          to: parsed.data.status,
        },
      },
    );
    if (!supportCase) {
      return privateJson(
        context,
        { error: "Support case not found" },
        { status: 404 },
      );
    }

    return privateJson(context, { success: true, supportCase });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "support.case_status_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Could not update support case" },
      { status: 500 },
    );
  }
}
