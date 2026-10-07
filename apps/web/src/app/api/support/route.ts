import { notificationRepository, supportCaseRepository, userRepository } from "@nexus/db";
import { generateId, can, consumeRateLimit } from "@nexus/security";
import { createSupportCaseSchema } from "@nexus/validation";
import { after, type NextRequest } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/observability";
import { deliverStoredNotificationsWebPush } from "../../../lib/services/notification-web-push-service";

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

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const user = await authService.getSession(
      request.cookies.get("nexus_session")?.value,
    );
    if (!user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (request.nextUrl.searchParams.get("scope") === "staff") {
      if (!can(user, "admin.moderation")) {
        return privateJson(context, { error: "Forbidden" }, { status: 403 });
      }

      const rows = await supportCaseRepository.listStaff();
      return privateJson(context, {
        cases: rows.map((row) => ({
          ...row.supportCase,
          requesterUsername: row.requesterUsername,
          requesterDisplayName: row.requesterDisplayName,
        })),
      });
    }

    return privateJson(context, {
      cases: await supportCaseRepository.listByRequester(user.id),
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "support.case_list_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Could not load support cases" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const user = await authService.getSession(
      request.cookies.get("nexus_session")?.value,
    );
    if (!user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const limit = await consumeRateLimit("supportCase", user.id);
    if (!limit.success) {
      return privateJson(
        context,
        { error: "Too many support cases" },
        { status: 429 },
      );
    }

    const parsed = createSupportCaseSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        { error: "Invalid support case", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const caseId = generateId("sup");
    const supportCase = await supportCaseRepository.createWithInitialMessage(
      {
        id: caseId,
        requesterId: user.id,
        category: parsed.data.category,
        subject: parsed.data.subject,
        status: "open",
      },
      {
        id: generateId("spm"),
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
    );

    after(async () => {
      try {
        const moderatorIds = await userRepository.listModeratorIds();
        const deliveries = await Promise.allSettled(
          moderatorIds.map((moderatorId) =>
            notificationRepository.create({
              id: generateId("not"),
              recipientId: moderatorId,
              title: "New support case",
              message: supportCase.subject,
              link: "/admin/support/" + supportCase.id,
              type: "system",
              category: "system",
            }),
          ),
        );
        const stored = deliveries.flatMap((delivery) =>
          delivery.status === "fulfilled" && delivery.value
            ? [delivery.value]
            : [],
        );
        await deliverStoredNotificationsWebPush(stored);
      } catch (error) {
        logRequestEvent({
          level: "warn",
          event: "support.case_notification_failed",
          context,
          status: 201,
          error,
        });
      }
    });

    return privateJson(
      context,
      { success: true, supportCase },
      { status: 201 },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "support.case_create_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      { error: "Could not create support case" },
      { status: 500 },
    );
  }
}
