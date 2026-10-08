import { supportCaseRepository, userRepository } from "@nexus/db";
import { generateId, can, consumeRateLimit } from "@nexus/security";
import {
  createSupportMessageSchema,
  updateSupportCaseStatusSchema,
} from "@nexus/validation";
import { after, type NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { parseBoundedJson } from "../../../../lib/bounded-json";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";
import { dispatchNotificationsBestEffort } from "../../../../lib/services/notification-dispatch-service";

function parsePage(value: string | null): number {
  return value && /^[1-9]\d{0,6}$/u.test(value)
    ? Number(value)
    : 1;
}

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

    const messages = await supportCaseRepository.pageMessages(
      id,
      parsePage(request.nextUrl.searchParams.get("messagePage")),
    );
    return privateJson(context, {
      supportCase: access.supportCase,
      messages: messages.items,
      messagePage: messages.page,
      messageTotalPages: messages.totalPages,
      messageTotal: messages.total,
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

    const body = await parseBoundedJson(request);
    if (!body.ok && body.reason === "too_large") {
      return privateJson(
        context,
        { error: "Support request body too large", code: "SUPPORT_BODY_TOO_LARGE" },
        { status: 413 },
      );
    }

    const parsed = createSupportMessageSchema.safeParse(
      body.ok ? body.value : null,
    );
    if (!parsed.success) {
      return privateJson(
        context,
        { error: "Invalid support message" },
        { status: 400 },
      );
    }

    // The requester's or moderator's view may be stale even before the
    // transaction starts. Never implicitly reopen a newly resolved ticket.
    if (
      access.supportCase.status === "closed" ||
      access.supportCase.status !== parsed.data.expectedStatus
    ) {
      const closed = access.supportCase.status === "closed";
      return privateJson(
        context,
        {
          error: closed
            ? "Closed support cases cannot receive new messages"
            : "Support case changed concurrently",
          code: closed ? "SUPPORT_CASE_CLOSED" : "SUPPORT_MESSAGE_CONFLICT",
        },
        { status: 409 },
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
        expectedStatus: parsed.data.expectedStatus,
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
      const current = await supportCaseRepository.findById(id);
      const closed = current?.status === "closed";
      return privateJson(
        context,
        {
          error: closed
            ? "Closed support cases cannot receive new messages"
            : "Support case changed concurrently",
          code: closed
            ? "SUPPORT_CASE_CLOSED"
            : "SUPPORT_MESSAGE_CONFLICT",
        },
        { status: 409 },
      );
    }

    after(async () => {
      try {
        const recipientIds =
          authorRole === "staff"
            ? [access.supportCase.requesterId]
            : await userRepository.listModeratorIds();
        await dispatchNotificationsBestEffort(
          recipientIds
            .filter((recipientId) => recipientId !== access.user!.id)
            .map((recipientId) => ({
              recipientId,
              title:
                authorRole === "staff"
                  ? "Support replied"
                  : "Support case updated",
              message: access.supportCase.subject,
              link:
                authorRole === "staff"
                  ? "/support/" + id
                  : "/admin/support/" + id,
              type: "system" as const,
              category: "system" as const,
            })),
        );
      } catch (error) {
        logRequestEvent({
          level: "warn",
          event: "support.message_notification_failed",
          context,
          status: 201,
          error,
        });
      }
    });

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

    const body = await parseBoundedJson(request);
    if (!body.ok && body.reason === "too_large") {
      return privateJson(
        context,
        { error: "Support request body too large", code: "SUPPORT_BODY_TOO_LARGE" },
        { status: 413 },
      );
    }

    const parsed = updateSupportCaseStatusSchema.safeParse(
      body.ok ? body.value : null,
    );
    if (!parsed.success) {
      return privateJson(
        context,
        { error: "Invalid support status" },
        { status: 400 },
      );
    }

    // Reject a stale staff view before the no-op shortcut. The DB conditional
    // update below also protects a race occurring after this read.
    if (access.supportCase.status !== parsed.data.expectedStatus) {
      return privateJson(
        context,
        { error: "Support case changed concurrently", code: "SUPPORT_STATUS_CONFLICT" },
        { status: 409 },
      );
    }

    if (access.supportCase.status === parsed.data.status) {
      return privateJson(context, { success: true, supportCase: access.supportCase });
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
      parsed.data.expectedStatus,
    );
    if (!supportCase) {
      return privateJson(
        context,
        { error: "Support case changed concurrently", code: "SUPPORT_STATUS_CONFLICT" },
        { status: 409 },
      );
    }

    if (supportCase.status !== access.supportCase.status) {
      after(async () => {
        try {
          await dispatchNotificationsBestEffort([
            {
              recipientId: access.supportCase!.requesterId,
              title: "Support case status changed",
              message:
                access.supportCase!.subject + ": " + supportCase.status,
              link: "/support/" + id,
              type: "system",
              category: "system",
            },
          ]);
        } catch (error) {
          logRequestEvent({
            level: "warn",
            event: "support.status_notification_failed",
            context,
            status: 200,
            error,
          });
        }
      });
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
