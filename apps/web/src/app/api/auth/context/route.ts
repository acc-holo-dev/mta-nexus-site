import { NextRequest, NextResponse } from "next/server";
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

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: privateHeaders });
  }

  const memberships = await organizationRepository.listUserMemberships(user.id);
  const organizationContexts = (
    await Promise.all(
      memberships.slice(0, 50).map(async (membership) => {
        const organization = await organizationRepository.findById(membership.organizationId);
        if (!organization) return null;

        return {
          id: organization.id,
          type: "organization" as const,
          name: organization.name,
          slug: organization.slug,
          role: membership.role,
        };
      })
    )
  ).filter((context): context is NonNullable<typeof context> => Boolean(context));

  return NextResponse.json(
    {
      activeContextId: user.activeContextId ?? "personal",
      contexts: [
        {
          id: "personal",
          type: "personal" as const,
          name: user.displayName,
          role: "personal" as const,
        },
        ...organizationContexts,
      ],
    },
    { headers: privateHeaders }
  );
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("sessionManagement", user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many context switches. Please try again shortly." },
        { status: 429 }
      );
    }

    const parsed = contextSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid context", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await authService.switchContext(user.id, parsed.data.contextId);
    return NextResponse.json(
      {
        success: true,
        activeContextId: updated.activeContextId ?? "personal",
        user: updated,
      },
      { headers: privateHeaders }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Context switch error:", error);
    return NextResponse.json({ error: "Failed to switch context" }, { status: 500 });
  }
}
