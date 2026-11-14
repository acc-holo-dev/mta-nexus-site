import type { Content } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
export const editablePublication = (row: Content) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  body: row.body,
  excerpt: row.excerpt ?? "",
  coverImageUrl: safeExternalWebUrl(row.coverImageUrl) ?? "",
  tags: row.tags,
  type: row.type,
  status: row.status,
  authorId: row.authorId,
  organizationId: row.organizationId,
  serverId: row.serverId,
  updatedAt: new Date(row.updatedAt).toISOString(),
});
