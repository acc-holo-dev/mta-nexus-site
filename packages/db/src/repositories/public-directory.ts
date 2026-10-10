import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import type { Server } from "@nexus/domain";
import { db } from "../client";
import { organizations, servers, users } from "../schema";
import { containsPattern } from "./search-pattern";

type DirectoryFilters = {
  page?: number;
  query?: string;
  verified?: boolean;
  sort?: "newest" | "name";
  language?: string;
  region?: string;
  gameMode?: string;
};
function pagination(filters: DirectoryFilters) {
  const page = Number.isSafeInteger(filters.page)
    ? Math.min(Math.max(filters.page ?? 1, 1), 1000)
    : 1;
  const query = filters.query?.trim().slice(0, 100);
  return { page, pattern: query ? containsPattern(query) : undefined };
}
function result<T>(rows: T[], page: number) {
  return { items: rows.slice(0, 24), page, hasMore: rows.length > 24 && page < 1000 };
}
class PublicDirectoryRepository {
  async pageServers(filters: DirectoryFilters = {}) {
    const { page, pattern } = pagination(filters);
    const rows = await db
      .select({
        ...getTableColumns(servers),
        description: sql<string | null>`left(${servers.description}, 500)`,
      })
      .from(servers)
      .where(
        and(
          eq(servers.visibility, "public"),
          eq(servers.status, "active"),
          filters.verified ? eq(servers.isVerified, true) : undefined,
          filters.language
            ? ilike(servers.language, containsPattern(filters.language.trim().slice(0, 60)))
            : undefined,
          filters.region
            ? ilike(servers.region, containsPattern(filters.region.trim().slice(0, 60)))
            : undefined,
          filters.gameMode
            ? ilike(servers.gameMode, containsPattern(filters.gameMode.trim().slice(0, 60)))
            : undefined,
          pattern
            ? or(
                ilike(servers.name, pattern),
                ilike(servers.description, pattern),
                ilike(servers.gameMode, pattern),
                sql`exists (select 1 from jsonb_array_elements_text(${servers.gameplayTags}) as tag(value) where tag.value ilike ${pattern})`,
              )
            : undefined,
        ),
      )
      .orderBy(
        ...(filters.sort === "name"
          ? [asc(servers.name), asc(servers.id)]
          : [desc(servers.createdAt), desc(servers.id)]),
      )
      .limit(25)
      .offset((page - 1) * 24);
    return result(rows as unknown as Server[], page);
  }
  async pageCreators(filters: DirectoryFilters = {}) {
    const { page, pattern } = pagination(filters);
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: sql<string | null>`left(${users.bio}, 500)`,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(
        and(
          inArray(users.role, ["developer", "admin"]),
          filters.verified ? eq(users.isVerified, true) : undefined,
          pattern
            ? or(
                ilike(users.username, pattern),
                ilike(users.displayName, pattern),
                ilike(users.bio, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(
        ...(filters.sort === "name"
          ? [asc(users.displayName), asc(users.id)]
          : [desc(users.createdAt), desc(users.id)]),
      )
      .limit(25)
      .offset((page - 1) * 24);
    return result(rows, page);
  }
  async pageOrganizations(filters: DirectoryFilters = {}) {
    const { page, pattern } = pagination(filters);
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: sql<string | null>`left(${organizations.description}, 500)`,
        logoUrl: organizations.logoUrl,
        isVerified: organizations.isVerified,
      })
      .from(organizations)
      .where(
        and(
          filters.verified ? eq(organizations.isVerified, true) : undefined,
          pattern
            ? or(
                ilike(organizations.name, pattern),
                ilike(organizations.slug, pattern),
                ilike(organizations.description, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(
        ...(filters.sort === "name"
          ? [asc(organizations.name), asc(organizations.id)]
          : [desc(organizations.createdAt), desc(organizations.id)]),
      )
      .limit(25)
      .offset((page - 1) * 24);
    return result(rows, page);
  }
}
export const publicDirectoryRepository = new PublicDirectoryRepository();
