import type { Content } from "@nexus/domain";
import { content } from "../schema";
export type ContentSummary = Pick<
  Content,
  "id" | "slug" | "title" | "excerpt" | "type" | "status" | "commentCount" | "updatedAt"
>;
export type ContentPageFilters = {
  page?: number;
  query?: string;
  type?: Content["type"];
  status?: Content["status"];
};
export const contentSummaryColumns = {
  id: content.id,
  slug: content.slug,
  title: content.title,
  excerpt: content.excerpt,
  type: content.type,
  status: content.status,
  commentCount: content.commentCount,
  updatedAt: content.updatedAt,
};
