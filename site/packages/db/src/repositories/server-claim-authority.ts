import { and, eq } from "drizzle-orm";
import { AppError, grantsServerManagement } from "@nexus/domain";
import type { db } from "../client";
import { organizationMembers, organizations, users } from "../schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Call after locking the server. Hold current grants until the claim transaction ends. */
export async function assertOrganizationServerClaimAuthority(
  tx: Tx,
  organizationId: string,
  requesterId: string,
  statusCode: 403 | 409 = 403,
): Promise<void> {
  const denied = () =>
    new AppError(
      "Current organization server management permission is required",
      statusCode,
      "SERVER_CLAIM_AUTHORITY_CHANGED",
    );
  const [organization] = await tx
    .select({ ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for("share")
    .limit(1);
  if (!organization) throw denied();
  if (organization.ownerId === requesterId) return;

  // Re-read the role; a stale session must not preserve a revoked administrator override.
  const [requester] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, requesterId))
    .for("share")
    .limit(1);
  if (requester?.role === "admin") return;
  const [membership] = await tx
    .select({
      role: organizationMembers.role,
      permissions: organizationMembers.permissions,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, requesterId),
      ),
    )
    .for("share")
    .limit(1);
  if (!grantsServerManagement(membership)) throw denied();
}
