import { AppError, grantsServerManagement, NotFoundError, UnauthorizedError } from "@nexus/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import { organizationMembers, organizations, products, servers, users } from "../schema";
import type { ResourceTransaction } from "../transaction";
import { lockInitiatingSession } from "./initiating-session";

/** Lock all referenced parents before grants, with organizations in stable order. */
export async function lockContentCreationAuthority(
  tx: ResourceTransaction,
  input: {
    actorId: string;
    token: string;
    productId?: string | null;
    serverId?: string | null;
    organizationId?: string | null;
    type: string;
    status: string;
  },
) {
  const [product] = input.productId
    ? await tx
        .select({
          id: products.id,
          authorId: products.authorId,
          organizationId: products.organizationId,
        })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1)
        .for("share")
    : [];
  if (input.productId && !product) throw new NotFoundError("Resource", input.productId);
  const [server] = input.serverId
    ? await tx
        .select({
          id: servers.id,
          ownerId: servers.ownerId,
          organizationId: servers.organizationId,
        })
        .from(servers)
        .where(eq(servers.id, input.serverId))
        .limit(1)
        .for("share")
    : [];
  if (input.serverId && !server) throw new NotFoundError("Server", input.serverId);

  const orgIds = [
    ...new Set(
      [product?.organizationId, server?.organizationId, input.organizationId].filter(
        (id): id is string => !!id,
      ),
    ),
  ].sort();
  const orgs = orgIds.length
    ? await tx
        .select({ id: organizations.id, ownerId: organizations.ownerId })
        .from(organizations)
        .where(inArray(organizations.id, orgIds))
        .orderBy(asc(organizations.id))
        .for("share")
    : [];
  if (orgs.length !== orgIds.length) throw new NotFoundError("Organization");
  const [actor] = await tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, input.actorId))
    .limit(1)
    .for("share");
  if (!actor) throw new UnauthorizedError("Authentication required");
  const memberships = orgIds.length
    ? await tx
        .select({
          organizationId: organizationMembers.organizationId,
          role: organizationMembers.role,
          permissions: organizationMembers.permissions,
        })
        .from(organizationMembers)
        .where(
          and(
            inArray(organizationMembers.organizationId, orgIds),
            eq(organizationMembers.userId, actor.id),
          ),
        )
        .orderBy(asc(organizationMembers.organizationId))
        .for("share")
    : [];
  const owner = (id: string) => orgs.some((org) => org.id === id && org.ownerId === actor.id);
  const member = (id: string) => memberships.find((item) => item.organizationId === id);
  if (product) {
    const membership = product.organizationId ? member(product.organizationId) : undefined;
    if (
      actor.role !== "admin" &&
      !(product.organizationId
        ? owner(product.organizationId) ||
          (!!membership &&
            (membership.role === "admin" ||
              (["member", "developer"].includes(membership.role) &&
                membership.permissions.includes("manage_products"))))
        : product.authorId === actor.id)
    )
      throw new NotFoundError("Resource", product.id);
  }
  if (
    server &&
    actor.role !== "admin" &&
    !(server.organizationId
      ? owner(server.organizationId) || grantsServerManagement(member(server.organizationId))
      : server.ownerId === actor.id)
  )
    throw new AppError("Server manager required", 403, "FORBIDDEN");
  if (
    input.organizationId &&
    !owner(input.organizationId) &&
    !["admin", "developer"].includes(member(input.organizationId)?.role ?? "")
  )
    throw new AppError("Organization publication rights revoked", 403, "FORBIDDEN");
  if (
    input.status === "published" &&
    !["post", "question"].includes(input.type) &&
    !["admin", "moderator"].includes(actor.role)
  )
    throw new AppError("Publication permission revoked", 403, "FORBIDDEN");
  await lockInitiatingSession(tx, actor.id, input.token);
}
