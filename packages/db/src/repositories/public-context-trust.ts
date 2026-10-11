import { and, eq, sql } from "drizzle-orm";
import { NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { organizations, servers } from "../schema";
import { publicApprovalRecords, type PublicApprovalCursor } from "./public-approval-records";
export type PublicContextKind = "organization" | "server";
class PublicContextTrustRepository {
  async page(kind: PublicContextKind, slug: string, cursor?: PublicApprovalCursor) {
    return db.transaction(
      async (tx) => {
        // Explicit correlation survives Drizzle's unqualification of single-table selections.
        const publicCount = sql<number>`(select count(*) from "content" as "public_content" where ${
          kind === "organization"
            ? sql`"public_content"."organization_id" = "organizations"."id"`
            : sql`"public_content"."server_id" = "servers"."id"`
        } and "public_content"."status" = 'published' and "public_content"."type" in ('article','news','devlog','update','announcement','post','question','review'))`.mapWith(
          Number,
        );
        const subject =
          kind === "organization"
            ? (
                await tx
                  .select({
                    id: organizations.id,
                    slug: organizations.slug,
                    name: organizations.name,
                    createdAt: organizations.createdAt,
                    verified: organizations.isVerified,
                    publications: publicCount,
                    publicServers:
                      sql<number>`(select count(*) from "servers" as "public_servers" where "public_servers"."organization_id" = "organizations"."id" and "public_servers"."status" = 'active' and "public_servers"."visibility" = 'public')`.mapWith(
                        Number,
                      ),
                    verifiedServers:
                      sql<number>`(select count(*) from "servers" as "public_servers" where "public_servers"."organization_id" = "organizations"."id" and "public_servers"."status" = 'active' and "public_servers"."visibility" = 'public' and "public_servers"."is_verified")`.mapWith(
                        Number,
                      ),
                  })
                  .from(organizations)
                  .where(eq(organizations.slug, slug))
                  .limit(1)
              )[0]
            : (
                await tx
                  .select({
                    id: servers.id,
                    slug: servers.slug,
                    name: servers.name,
                    createdAt: servers.createdAt,
                    verified: servers.isVerified,
                    publications: publicCount,
                    organizationSlug: organizations.slug,
                    organizationName: organizations.name,
                    organizationVerified: organizations.isVerified,
                    ownershipKind: sql<
                      "organization" | "personal" | "unclaimed"
                    >`case when ${servers.organizationId} is not null then 'organization' when ${servers.ownerId} is not null then 'personal' else 'unclaimed' end`,
                  })
                  .from(servers)
                  .leftJoin(organizations, eq(organizations.id, servers.organizationId))
                  .where(
                    and(
                      eq(servers.slug, slug),
                      eq(servers.visibility, "public"),
                      eq(servers.status, "active"),
                    ),
                  )
                  .limit(1)
              )[0];
        if (!subject) throw new NotFoundError(kind === "organization" ? "Organization" : "Server");
        const records = await publicApprovalRecords(
          tx,
          {
            targetId: subject.id,
            types: [kind],
            contextParts: [1, "public-context-approvals", kind, subject.id],
          },
          cursor,
        );
        return {
          subject: {
            kind,
            slug: subject.slug,
            name: subject.name,
            createdAt: subject.createdAt,
            verified: subject.verified,
            publications: subject.publications,
            servers:
              "publicServers" in subject
                ? { total: subject.publicServers, verified: subject.verifiedServers }
                : null,
            organization:
              "organizationSlug" in subject && subject.organizationSlug && subject.organizationName
                ? {
                    slug: subject.organizationSlug,
                    name: subject.organizationName,
                    verified: subject.organizationVerified === true,
                  }
                : null,
            ownershipKind: "ownershipKind" in subject ? subject.ownershipKind : null,
          },
          ...records,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const publicContextTrustRepository = new PublicContextTrustRepository();
