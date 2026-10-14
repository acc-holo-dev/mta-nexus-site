import { readAuthJson } from "../../../../lib/auth-request-body";
import { rejectUnsafeBrowserRequest } from "../../../../lib/browser-request-guard";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authService } from "../../../../lib/services/auth-service";
import { organizationRepository } from "@nexus/db";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";

const contextSchema = z
  .object({
    contextId: z.string().trim().min(1).max(128),
  })
  .strict();

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const [ownedOrganizations, memberships] =
      await Promise.all([
        organizationRepository.listOwnedByUser(
          user.id,
          50,
        ),
        organizationRepository.listUserMemberships(
          user.id,
        ),
      ]);

    const contextsById = new Map<
      string,
      {
        id: string;
        type: "organization";
        name: string;
        slug: string;
        role: string;
      }
    >();

    for (const organization of ownedOrganizations) {
      contextsById.set(organization.id, {
        id: organization.id,
        type: "organization",
        name: organization.name,
        slug: organization.slug,
        role: "owner",
      });
    }

    const remainingMemberships = memberships
      .filter(
        (membership) =>
          !contextsById.has(
            membership.organizationId,
          ),
      )
      .slice(
        0,
        Math.max(0, 50 - contextsById.size),
      );

    const memberOrganizations = remainingMemberships.length
      ? await organizationRepository.findSummariesByIds(
          remainingMemberships.map(membership => membership.organizationId),
        )
      : [];
    const memberOrganizationsById = new Map(
      memberOrganizations.map(organization => [organization.id, organization]),
    );

    // An IN query can return rows in a different order from the memberships.
    for (const membership of remainingMemberships) {
      const organization = memberOrganizationsById.get(membership.organizationId);
      if (!organization) continue;
      contextsById.set(organization.id, {
        id: organization.id,
        type: "organization",
        name: organization.name,
        slug: organization.slug,
        role: membership.role,
      });
    }

    const organizationContexts = Array.from(
      contextsById.values(),
    ).slice(0, 50);

    const requestedActiveContextId =
      user.activeContextId ?? "personal";
    const activeContextId =
      requestedActiveContextId === "personal" ||
      organizationContexts.some(
        (organization) =>
          organization.id ===
          requestedActiveContextId,
      )
        ? requestedActiveContextId
        : "personal";

    return json(context, {
      activeContextId,
      contexts: [
        {
          id: "personal",
          type: "personal" as const,
          name: user.displayName,
          role: "personal" as const,
        },
        ...organizationContexts,
      ],
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "auth.context.list_failed",
      context,
      status: 503,
      error,
    });
    return json(
      context,
      {
        error:
          "Account contexts are temporarily unavailable.",
      },
      503,
    );
  }
}

export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeBrowserRequest(request);
  if (rejected) return rejected;
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "sessionManagement",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many context switches. Please try again shortly.",
        },
        429,
      );
    }

    const parsed = contextSchema.safeParse(
      await readAuthJson(request),
    );
    if (!parsed.success) {
      return json(
        context,
        {
          error: "Invalid context",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const updated =
      await authService.switchContext(
        user.id,
        parsed.data.contextId,
      );

    return json(context, {
      success: true,
      activeContextId:
        updated.activeContextId ?? "personal",
      user: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        context,
        {
          error: error.message,
          code: error.code,
        },
        error.statusCode,
      );
    }

    logRequestEvent({
      level: "error",
      event: "auth.context.switch_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      { error: "Failed to switch context" },
      500,
    );
  }
}

