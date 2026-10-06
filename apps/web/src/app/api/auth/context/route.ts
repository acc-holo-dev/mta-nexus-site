import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "../../../../lib/services/auth-service";
import { organizationRepository } from "@nexus/db";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";

const contextSchema = z
  .object({
    contextId: z.string().trim().min(1).max(128),
  })
  .strict();

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return json({ error: "Authentication required" }, 401);
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
    .filter(
      (membership) =>
        !contextsById.has(membership.organizationId),
    )
    .slice(0, Math.max(0, 50 - contextsById.size));

  const memberOrganizations = await Promise.all(
    remainingMemberships.map(async (membership) => ({
      membership,
      organization: await organizationRepository.findById(
        membership.organizationId,
      ),
    })),
  );

  for (const { membership, organization } of memberOrganizations) {
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
        organization.id === requestedActiveContextId,
    )
      ? requestedActiveContextId
      : "personal";

  return json({
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
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json({ error: "Authentication required" }, 401);
    }

    const rateLimit = await consumeRateLimit(
      "sessionManagement",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        {
          error:
            "Too many context switches. Please try again shortly.",
        },
        429,
      );
    }

    const parsed = contextSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return json(
        {
          error: "Invalid context",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const updated = await authService.switchContext(
      user.id,
      parsed.data.contextId,
    );

    return json({
      success: true,
      activeContextId: updated.activeContextId ?? "personal",
      user: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        { error: error.message, code: error.code },
        error.statusCode,
      );
    }

    console.error("Context switch error:", error);
    return json({ error: "Failed to switch context" }, 500);
  }
}
