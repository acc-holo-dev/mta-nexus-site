import { eq } from "drizzle-orm";
import { db } from "../client";
import { organizations, organizationMembers } from "../schema";
import type { Organization, OrganizationMember } from "@nexus/domain";

export class OrganizationRepository {
  async listAll(): Promise<Organization[]> {
        const rows = await db.select().from(organizations);
    return rows as unknown as Organization[];
  }

  async findById(id: string): Promise<Organization | null> {
        const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return (rows[0] as unknown as Organization) || null;
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
