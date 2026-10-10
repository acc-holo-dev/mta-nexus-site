import { and, eq } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@nexus/domain";
import { organizationMembers, organizations, users } from "../schema";
import type { ResourceTransaction } from "./entitlements";

/** Uses the existing product management policy, holding live grants to commit. */
export async function assertProductMutationAuthority(
  tx: ResourceTransaction,
  product: { id: string; authorId: string; organizationId: string | null },
  actorId: string,
) {
  // Parent product must already be locked. Organization -> user -> membership
  // follows the organization authority path used by server management.
  const [organization] = product.organizationId
    ? await tx
        .select({ ownerId: organizations.ownerId })
        .from(organizations)
        .where(eq(organizations.id, product.organizationId))
        .limit(1)
        .for("share")
    : [];
  const [actor] = await tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1)
    .for("share");
  if (!actor) throw new NotFoundError("Resource", product.id);
  if (actor.role === "admin" || (!product.organizationId && product.authorId === actor.id))
    return actor;
  if (organization?.ownerId === actor.id) return actor;
  if (product.organizationId && organization) {
    const [membership] = await tx
      .select({ role: organizationMembers.role, permissions: organizationMembers.permissions })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, product.organizationId),
          eq(organizationMembers.userId, actor.id),
        ),
      )
      .limit(1)
      .for("share");
    if (
      membership &&
      (membership.role === "owner" ||
        membership.role === "admin" ||
        membership.permissions.includes("manage_products"))
    )
      return actor;
  }
  throw new NotFoundError("Resource", product.id);
}

export async function assertBuildModerationAuthority(tx: ResourceTransaction, actorId: string) {
  const [actor] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1)
    .for("share");
  if (actor?.role !== "admin" && actor?.role !== "moderator")
    throw new ForbiddenError("Moderator privilege is required");
  return actor;
}
