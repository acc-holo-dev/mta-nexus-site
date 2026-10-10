import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { organizations, organizationMembers } from "../schema";
import type { Organization, OrganizationMember } from "@nexus/domain";

export type ServerManageableOrganization = Pick<Organization, "id" | "name" | "slug">;

export class OrganizationRepository {
  /** Return only manageable organizations and no membership or private profile data. */
  async listServerManageableByUser(
    userId: string,
    requestedLimit = 100,
  ): Promise<ServerManageableOrganization[]> {
    if (!userId) throw new RangeError("A user ID is required");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 100;
    return db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(or(
        eq(organizations.ownerId, userId),
        exists(db.select({ id: organizationMembers.id }).from(organizationMembers).where(and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, userId),
          or(
            inArray(organizationMembers.role, ["owner", "admin"]),
            sql`${organizationMembers.permissions} @> ${JSON.stringify(["manage_servers"])}::jsonb`,
          ),
        ))),
      ))
      .orderBy(asc(organizations.name), asc(organizations.id))
      .limit(limit);
  }

  async searchPublic(term: string, limit = 50): Promise<Organization[]> {
    const pattern = containsPattern(term);
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    const rows = await db.select().from(organizations).where(or(
      ilike(organizations.name, pattern),
      ilike(organizations.slug, pattern),
      ilike(organizations.description, pattern),
    )).orderBy(desc(organizations.updatedAt), desc(organizations.id)).limit(boundedLimit);
    return rows as unknown as Organization[];
  }

  async listAll(limit?: number): Promise<Organization[]> {
    const query = db.select().from(organizations);
    const boundedLimit =
      limit === undefined
        ? undefined
        : Number.isFinite(limit)
          ? Math.min(Math.max(Math.floor(limit), 1), 100)
          : 100;
    const rows = boundedLimit === undefined ? await query : await query.limit(boundedLimit);
    return rows as unknown as Organization[];
  }

  async listOwnedByUser(
    userId: string,
    limit = 50,
  ): Promise<Organization[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 50;
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId))
      .limit(boundedLimit);
    return rows as unknown as Organization[];
  }

  async findById(id: string): Promise<Organization | null> {
        const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return (rows[0] as unknown as Organization) || null;
  }

  async findSummariesByIds(ids: readonly string[]): Promise<Pick<Organization, "id" | "name" | "slug">[]> {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return [];
    return db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(inArray(organizations.id, uniqueIds));
  }

  async findBySlug(slug: string): Promise<Organization | null> {
        const rows = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    return (rows[0] as unknown as Organization) || null;
  }

  async create(data: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
    ownerId: string;
  }): Promise<Organization> {
    const values = {
      ...data,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

        const rows = await db.insert(organizations).values(values).returning();
    return rows[0] as unknown as Organization;
  }

  async listUserMemberships(userId: string): Promise<OrganizationMember[]> {
        const rows = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    return rows as unknown as OrganizationMember[];
  }
}

export const organizationRepository = new OrganizationRepository();
