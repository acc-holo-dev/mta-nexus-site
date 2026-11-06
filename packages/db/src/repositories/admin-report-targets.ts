import type { Report } from "@nexus/domain";
import { eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { comments, content, products, resourceQaThreads, servers, users } from "../schema";

export type AdminReportTargetPreview = {
  title: string | null;
  href: string | null;
  detail: string | null;
};

function idsFor(type: Report["targetType"], reports: readonly Report[]) {
  return [
    ...new Set(reports.filter((report) => report.targetType === type).map((r) => r.targetId)),
  ];
}

/**
 * Resolve human-readable titles and public/staff deep links for a page of
 * general moderation reports (including resource Q&A threads).
 */
export async function resolveAdminReportTargets(
  reports: readonly Report[],
): Promise<Map<string, AdminReportTargetPreview>> {
  const result = new Map<string, AdminReportTargetPreview>();
  if (reports.length === 0) return result;

  const productIds = idsFor("product", reports);
  const serverIds = idsFor("server", reports);
  const contentIds = idsFor("content", reports);
  const commentIds = idsFor("comment", reports);
  const userIds = idsFor("user", reports);
  const qaIds = idsFor("resource_qa_thread", reports);

  const [productRows, serverRows, contentRows, commentRows, userRows, qaRows] = await Promise.all([
    productIds.length
      ? db
          .select({ id: products.id, title: products.title, slug: products.slug })
          .from(products)
          .where(inArray(products.id, productIds))
      : Promise.resolve([]),
    serverIds.length
      ? db
          .select({ id: servers.id, name: servers.name, slug: servers.slug })
          .from(servers)
          .where(inArray(servers.id, serverIds))
      : Promise.resolve([]),
    contentIds.length
      ? db
          .select({ id: content.id, title: content.title, slug: content.slug })
          .from(content)
          .where(inArray(content.id, contentIds))
      : Promise.resolve([]),
    commentIds.length
      ? db
          .select({
            id: comments.id,
            contentId: comments.contentId,
            text: comments.text,
            title: content.title,
            slug: content.slug,
          })
          .from(comments)
          .innerJoin(content, eq(content.id, comments.contentId))
          .where(inArray(comments.id, commentIds))
      : Promise.resolve([]),
    userIds.length
      ? db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
    qaIds.length
      ? db
          .select({
            id: resourceQaThreads.id,
            body: resourceQaThreads.body,
            title: products.title,
            slug: products.slug,
          })
          .from(resourceQaThreads)
          .innerJoin(products, eq(products.id, resourceQaThreads.productId))
          .where(inArray(resourceQaThreads.id, qaIds))
      : Promise.resolve([]),
  ]);

  for (const row of productRows) {
    result.set(`product:${row.id}`, {
      title: row.title,
      href: `/market/${encodeURIComponent(row.slug)}`,
      detail: null,
    });
  }
  for (const row of serverRows) {
    result.set(`server:${row.id}`, {
      title: row.name,
      href: `/servers/${encodeURIComponent(row.slug)}`,
      detail: null,
    });
  }
  for (const row of contentRows) {
    result.set(`content:${row.id}`, {
      title: row.title,
      href: `/articles/${encodeURIComponent(row.slug)}`,
      detail: null,
    });
  }
  for (const row of commentRows) {
    const href = row.contentId
      ? `/admin/community/${encodeURIComponent(row.contentId)}/discussion/${encodeURIComponent(row.id)}`
      : row.slug
        ? `/articles/${encodeURIComponent(row.slug)}`
        : null;
    result.set(`comment:${row.id}`, {
      title: row.title,
      href,
      detail: row.text.slice(0, 160),
    });
  }
  for (const row of userRows) {
    result.set(`user:${row.id}`, {
      title: row.displayName || row.username,
      href: `/users/${encodeURIComponent(row.username)}`,
      detail: `@${row.username}`,
    });
  }
  for (const row of qaRows) {
    result.set(`resource_qa_thread:${row.id}`, {
      title: row.title,
      href: row.slug
        ? `/market/${encodeURIComponent(row.slug)}?qa=${encodeURIComponent(row.id)}#resource-qa`
        : null,
      detail: row.body.slice(0, 160),
    });
  }

  return result;
}
