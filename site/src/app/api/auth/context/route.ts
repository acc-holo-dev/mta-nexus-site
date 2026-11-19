import { organizationRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authAppErrorText } from "../../../../features/accounts/auth-app-error";
import { authContextApiCopy } from "../../../../features/accounts/auth-context-api-copy";
import { readAuthJson } from "../../../../lib/http/auth-request-body";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

const contextSchema = z
  .object({
    contextId: z.string().trim().min(1).max(128),
    expectedActorId: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value.trim() === value),
  })
  .strict();

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = authContextApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    const [ownedOrganizations, memberships] = await Promise.all([
      organizationRepository.listOwnedByUser(user.id, 50),
      organizationRepository.listUserMemberships(user.id),
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
      .filter((membership) => !contextsById.has(membership.organizationId))
      .slice(0, Math.max(0, 50 - contextsById.size));

    const memberOrganizations = remainingMemberships.length
      ? await organizationRepository.findSummariesByIds(
          remainingMemberships.map((membership) => membership.organizationId),
        )
      : [];
    const memberOrganizationsById = new Map(
      memberOrganizations.map((organization) => [organization.id, organization]),
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

    const requestedActiveContextId = user.activeContextId ?? "personal";
    if (requestedActiveContextId !== "personal" && !contextsById.has(requestedActiveContextId)) {
      const active = await organizationRepository.findUserContext(
        requestedActiveContextId,
        user.id,
      );
      if (active) {
        // Keep the currently active organization visible even outside the first page.
        if (contextsById.size >= 50) {
          const last = Array.from(contextsById.keys()).at(-1);
          if (last) contextsById.delete(last);
        }
        contextsById.set(active.id, { ...active, type: "organization" });
      }
    }
    const organizationContexts = Array.from(contextsById.values()).slice(0, 50);
    const activeContextId =
      requestedActiveContextId === "personal" ||
      organizationContexts.some((organization) => organization.id === requestedActiveContextId)
        ? requestedActiveContextId
        : "personal";

    return json(context, {
      actorId: user.id,
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
        error: copy.listUnavailable,
      },
      503,
    );
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authContextApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const authenticated = await authService.getSessionIdentity(token);

    if (!authenticated || !token) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    const { user } = authenticated;
    const rateLimit = await consumeRateLimit("sessionManagement", user.id);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const parsed = contextSchema.safeParse(await readAuthJson(request));
    if (!parsed.success) {
      return json(
        context,
        {
          error: copy.invalidContext,
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (parsed.data.expectedActorId !== user.id) {
      return json(context, { error: copy.accountChanged, code: "ACTOR_CHANGED" }, 409);
    }

    const updated = await authService.switchContext(user.id, parsed.data.contextId, token);

    return json(context, {
      success: true,
      actorId: user.id,
      activeContextId: updated.activeContextId ?? "personal",
      user: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        context,
        {
          error: authAppErrorText(error, {
            unauthorized: copy.authenticationRequired,
            conflict: copy.accountChanged,
            failed: copy.switchFailed,
          }),
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
    return json(context, { error: copy.switchFailed }, 500);
  }
});
