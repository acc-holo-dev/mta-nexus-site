import {
  db,
  organizationMembers,
  organizationRepository,
  productRepository,
  serverRepository,
  servers,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { and, eq } from "drizzle-orm";
import { productService } from "../../site/src/lib/services/product-service";
import { serverService } from "../../site/src/lib/services/server-service";
import { assertProductMutationAuthority } from "../../packages/db/src/repositories/product-mutation-authority";

export {
  assertProductMutationAuthority,
  db,
  eq,
  productRepository,
  productService,
  serverRepository,
  serverService,
  servers,
  userRepository,
};

/** Unique suffix for disposable organization resource-management fixtures. */
export function fixtureSuffix(label = "org_rm") {
  return `${label}_${Date.now().toString(36)}_${process.pid}`;
}

/** Create a disposable user for organization resource-management suites. */
export async function createOrgUser(input: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role?: string;
}) {
  await userRepository.create({
    role: "user",
    ...input,
  });
}

/** Issue a short-lived initiating session for organization mutations. */
export async function createOrgSession(userId: string, token = `tok_${userId}`) {
  await sessionRepository.create({
    id: `ses_${userId}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 60_000),
  });
  return token;
}

/** Create a disposable organization owned by `ownerId`. */
export async function createOrganization(input: {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}) {
  await organizationRepository.create(input);
}

/** Insert an organization membership row with the given role and permissions. */
export async function addOrganizationMember(input: {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  permissions: string[];
}) {
  await db.insert(organizationMembers).values({
    ...input,
    createdAt: new Date(),
  });
}

/** Remove one organization membership by organization and user ids. */
export async function removeOrganizationMember(organizationId: string, userId: string) {
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    );
}
