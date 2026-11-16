import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
  keyset?: boolean;
  cursor?: { createdAt: string; id: string; direction?: "older" | "newer" };
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
function directoryResult<T extends { id: string; cursorTime?: string }>(
  rows: T[],
  page: number,
  filters: DirectoryFilters,
) {
  if (!filters.keyset) return { ...result(rows, page), nextCursor: null, previousCursor: null };
  const newer = filters.cursor?.direction === "newer",
    selected = rows.slice(0, 24);
  if (newer) selected.reverse();
  const first = selected[0],
    last = selected.at(-1);
  const hasMore = newer ? selected.length > 0 : rows.length > 24;
  const hasPrevious = newer ? rows.length > 24 : !!filters.cursor && selected.length > 0;
  return {
    items: selected.map(({ cursorTime: _cursorTime, ...row }) => row),
    page: 1,
    hasMore,
    nextCursor: hasMore && last?.cursorTime ? { createdAt: last.cursorTime, id: last.id } : null,
    previousCursor:
      hasPrevious && first?.cursorTime ? { createdAt: first.cursorTime, id: first.id } : null,
  };
}
function continuation(
  time: typeof servers.createdAt | typeof users.createdAt | typeof organizations.createdAt,
  id: typeof servers.id | typeof users.id | typeof organizations.id,
  filters: DirectoryFilters,
) {
  return filters.keyset && filters.cursor
    ? filters.cursor.direction === "newer"
      ? sql`(${time}, ${id}) > (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
      : sql`(${time}, ${id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
    : undefined;
}
function cursorTime(
  time: typeof servers.createdAt | typeof users.createdAt | typeof organizations.createdAt,
) {
  return sql<string>`to_char(${time} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}
class PublicDirectoryRepository {
  async pageServers(filters: DirectoryFilters = {}) {
    const { page, pattern } = pagination(filters);
    const query = db
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        bannerUrl: servers.bannerUrl,
        logoUrl: servers.logoUrl,
        gameMode: servers.gameMode,
        maxPlayers: servers.maxPlayers,
        isVerified: servers.isVerified,
        ipAddress: servers.ipAddress,
        port: servers.port,
        language: servers.language,
        region: servers.region,
        gameplayTags: servers.gameplayTags,
        description: sql<string | null>`left(${servers.description}, 500)`,
        ...(filters.keyset ? { cursorTime: cursorTime(servers.createdAt) } : {}),
      })
      .from(servers)
      .where(
        and(
          eq(servers.visibility, "public"),
          eq(servers.status, "active"),
          continuation(servers.createdAt, servers.id, filters),
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
        ...(filters.keyset && filters.cursor?.direction === "newer"
          ? [asc(servers.createdAt), asc(servers.id)]
          : filters.sort === "name" && !filters.keyset
            ? [asc(servers.name), asc(servers.id)]
            : [desc(servers.createdAt), desc(servers.id)]),
      )
      .limit(25);
    const rows = await (filters.keyset ? query : query.offset((page - 1) * 24));
    const pageResult = directoryResult(rows, page, filters);
    return pageResult;
  }
  async pageCreators(filters: DirectoryFilters = {}) {
    const { page, pattern } = pagination(filters);
    const query = db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: sql<string | null>`left(${users.bio}, 500)`,
        isVerified: users.isVerified,
        ...(filters.keyset ? { cursorTime: cursorTime(users.createdAt) } : {}),
      })
      .from(users)
      .where(
        and(
          inArray(users.role, ["developer", "admin"]),
          continuation(users.createdAt, users.id, filters),
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
        ...(filters.keyset && filters.cursor?.direction === "newer"
          ? [asc(users.createdAt), asc(users.id)]
          : filters.sort === "name" && !filters.keyset
            ? [asc(users.displayName), asc(users.id)]
            : [desc(users.createdAt), desc(users.id)]),
      )
      .limit(25);
    const rows = await (filters.keyset ? query : query.offset((page - 1) * 24));
    return directoryResult(rows, page, filters);
  }
  async pageOrganizations(filters: DirectoryFilters = {}) {
    const { page, pattern } = pagination(filters);
    const query = db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: sql<string | null>`left(${organizations.description}, 500)`,
        logoUrl: organizations.logoUrl,
        isVerified: organizations.isVerified,
        ...(filters.keyset ? { cursorTime: cursorTime(organizations.createdAt) } : {}),
      })
      .from(organizations)
      .where(
        and(
          continuation(organizations.createdAt, organizations.id, filters),
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
        ...(filters.keyset && filters.cursor?.direction === "newer"
          ? [asc(organizations.createdAt), asc(organizations.id)]
          : filters.sort === "name" && !filters.keyset
            ? [asc(organizations.name), asc(organizations.id)]
            : [desc(organizations.createdAt), desc(organizations.id)]),
      )
      .limit(25);
    const rows = await (filters.keyset ? query : query.offset((page - 1) * 24));
    return directoryResult(rows, page, filters);
  }
}
export const publicDirectoryRepository = new PublicDirectoryRepository();
