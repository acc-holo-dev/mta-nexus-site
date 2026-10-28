import {
  supportPrivateJson,
  supportMutationGuard,
  supportFailure,
} from "../../../../lib/support-http";
import { supportCaseRepository, userRepository } from "@nexus/db";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { generateId, can, consumeRateLimit } from "@nexus/security";
import { createSupportMessageSchema, updateSupportCaseStatusSchema } from "@nexus/validation";
import { after, type NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { parseBoundedJson } from "../../../../lib/bounded-json";
import {
  parseSupportIdempotencyKey,
  supportMutationFingerprint,
} from "../../../../lib/support-idempotency";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/observability";
import { dispatchNotificationsBestEffort } from "../../../../lib/services/notification-dispatch-service";

async function loadAuthorizedCase(request: NextRequest, id: string) {
  const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
  if (!user) return { user: null, supportCase: null, staff: false };

  const supportCase = await supportCaseRepository.findById(id);
  if (!supportCase) return { user, supportCase: null, staff: false };

  const staff = can(user, "admin.moderation");
  if (supportCase.requesterId !== user.id && !staff) {
    return { user, supportCase: null, staff: false };
  }

  return { user, supportCase, staff };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);

  try {
    const { id } = await params;
    if (!/^sup_[a-f0-9]{24}$/.test(id)) {
      return supportPrivateJson(
        context,
        request,
        { error: "Support case not found" },
        { status: 404 },
      );
    }

    const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!user) {
      return supportPrivateJson(
        context,
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    const values = request.nextUrl.searchParams.getAll("messagePage");
    if (values.length > 1 || (values.length === 1 && !/^[1-9]\d{0,6}$/u.test(values[0] ?? "")))
      throw new AppError("Invalid message page", 400, "VALIDATION_ERROR");
    if (!(await consumeRateLimit("search", user.id)).success) throw new RateLimitExceededError();
    const access = await supportCaseRepository.authorizedThread(
      id,
      user.id,
      values[0] ? Number(values[0]) : 1,
    );
    const messages = access.messages;
    return supportPrivateJson(context, request, {
      supportCase: access.supportCase,
      messages: messages.items,
      messagePage: messages.page,
      messageTotalPages: messages.totalPages,
      messageTotal: messages.total,
      staff: access.staff,
      requester: access.requester,
    });
  } catch (error) {
    return supportFailure(request, context, error, "support.case_read_failed");
  }
}

export const POST = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = createRequestLogContext(request);

    try {
      const { id } = await params;
      if (!/^sup_[a-f0-9]{24}$/u.test(id))
        return supportPrivateJson(
          context,
          request,
          { error: "Support case not found" },
          { status: 404 },
        );
      const access = await loadAuthorizedCase(request, id);
      if (!access.user) {
        return supportPrivateJson(
          context,
          request,
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      if (!access.supportCase) {
        return supportPrivateJson(
          context,
          request,
          { error: "Support case not found" },
          { status: 404 },
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

      const parsed = createSupportMessageSchema.safeParse(body.ok ? body.value : null);
      if (!parsed.success) {
        return supportPrivateJson(
          context,
          request,
          { error: "Invalid support message" },
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
        operation: "reply",
        caseId: id,
        message: parsed.data.message,
        expectedStatus: parsed.data.expectedStatus,
        ...(parsed.data.expectedUpdatedAt
          ? { expectedUpdatedAt: parsed.data.expectedUpdatedAt }
          : {}),
      });
      const scope = {
        actorId: access.user.id,
        requestKey,
        operation: "reply" as const,
        fingerprint,
      };
      const previous = await supportCaseRepository.findMutationReplay(scope);
      if (previous.kind === "key_conflict") {
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
      if (previous.kind === "replayed") {
        if (!previous.message) throw new Error("Support reply replay is missing its message");
        return supportPrivateJson(
          context,
          request,
          {
            success: true,
            supportCase: previous.supportCase,
            message: previous.message,
            replayed: true,
          },
          { status: 201 },
        );
      }

      // The requester's or moderator's view may be stale even before the
      // transaction starts. Never implicitly reopen a newly resolved ticket.
      if (
        access.supportCase.status === "closed" ||
        access.supportCase.status !== parsed.data.expectedStatus
      ) {
        const closed = access.supportCase.status === "closed";
        return supportPrivateJson(
          context,
          request,
          {
            error: closed
              ? "Closed support cases cannot receive new messages"
              : "Support case changed concurrently",
            code: closed ? "SUPPORT_CASE_CLOSED" : "SUPPORT_MESSAGE_CONFLICT",
          },
          { status: 409 },
        );
      }

      const limit = await consumeRateLimit("supportMessage", access.user.id);
      if (!limit.success) {
        return supportPrivateJson(
          context,
          request,
          { error: "Too many support messages" },
          { status: 429 },
        );
      }

      const authorRole = access.supportCase.requesterId === access.user.id ? "requester" : "staff";
      const messageId = generateId("spm");
      const result = await supportCaseRepository.addIdempotentMessage(
        {
          id: messageId,
          caseId: id,
          authorId: access.user.id,
          authorRole,
          body: parsed.data.message,
          expectedStatus: parsed.data.expectedStatus,
          ...(parsed.data.expectedUpdatedAt
            ? { expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt) }
            : {}),
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
        { ...scope, caseId: id, messageId },
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

      if (result.kind === "stale") {
        const current = await supportCaseRepository.findById(id);
        const closed = current?.status === "closed";
        return supportPrivateJson(
          context,
          request,
          {
            error: closed
              ? "Closed support cases cannot receive new messages"
              : "Support case changed concurrently",
            code: closed ? "SUPPORT_CASE_CLOSED" : "SUPPORT_MESSAGE_CONFLICT",
          },
          { status: 409 },
        );
      }

      if (result.kind === "created" && authorRole === "requester")
        after(async () => {
          try {
            const recipientIds = await userRepository.listModeratorIds();
            await dispatchNotificationsBestEffort(
              recipientIds
                .filter((recipientId) => recipientId !== access.user?.id)
                .map((recipientId) => ({
                  recipientId,
                  title: "Support case updated",
                  message: "A support case has a new requester message.",
                  link: `/admin/support/${id}`,
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

      return supportPrivateJson(
        context,
        request,
        {
          success: true,
          supportCase: result.supportCase,
          message: result.message,
          replayed: result.kind === "replayed",
        },
        { status: 201 },
      );
    } catch (error) {
      return supportFailure(request, context, error, "support.message_create_failed");
    }
  },
);

export const PATCH = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = createRequestLogContext(request);

    try {
      const { id } = await params;
      if (!/^sup_[a-f0-9]{24}$/u.test(id))
        return supportPrivateJson(
          context,
          request,
          { error: "Support case not found" },
          { status: 404 },
        );
      const access = await loadAuthorizedCase(request, id);
      if (!access.user) {
        return supportPrivateJson(
          context,
          request,
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      if (!access.supportCase) {
        return supportPrivateJson(
          context,
          request,
          { error: "Support case not found" },
          { status: 404 },
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

      const parsed = updateSupportCaseStatusSchema.safeParse(body.ok ? body.value : null);
      if (!parsed.success) {
        return supportPrivateJson(
          context,
          request,
          { error: "Invalid support status" },
          { status: 400 },
        );
      }

      if (
        !access.staff &&
        (!parsed.data.expectedUpdatedAt ||
          access.supportCase.status === "closed" ||
          parsed.data.status === "closed")
      )
        return supportPrivateJson(context, request, { error: "Forbidden" }, { status: 403 });
      if (!(await consumeRateLimit("supportMessage", access.user.id)).success)
        return supportPrivateJson(
          context,
          request,
          { error: "Too many requests" },
          { status: 429 },
        );
      // Reject a stale staff view before the no-op shortcut. The DB conditional
      // update below also protects a race occurring after this read.
      if (access.supportCase.status !== parsed.data.expectedStatus) {
        return supportPrivateJson(
          context,
          request,
          { error: "Support case changed concurrently", code: "SUPPORT_STATUS_CONFLICT" },
          { status: 409 },
        );
      }

      const supportCase = await supportCaseRepository.updateStatus(
        id,
        parsed.data.status,
        {
          id: generateId("aud"),
          actorId: access.user.id,
          actorType: access.staff ? "admin" : "user",
          action: "support.case.status_changed",
          targetId: id,
          targetType: "support_case",
          details: {
            from: access.supportCase.status,
            to: parsed.data.status,
          },
        },
        parsed.data.expectedStatus,
        ...(parsed.data.expectedUpdatedAt
          ? ([new Date(parsed.data.expectedUpdatedAt)] as const)
          : []),
      );
      if (!supportCase) {
        return supportPrivateJson(
          context,
          request,
          { error: "Support case changed concurrently", code: "SUPPORT_STATUS_CONFLICT" },
          { status: 409 },
        );
      }

      return supportPrivateJson(context, request, { success: true, supportCase });
    } catch (error) {
      return supportFailure(request, context, error, "support.case_status_failed");
    }
  },
);
