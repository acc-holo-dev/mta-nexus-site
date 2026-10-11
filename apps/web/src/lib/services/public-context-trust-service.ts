import { publicContextTrustRepository } from "@nexus/db";
import { NotFoundError } from "@nexus/domain";
import type {
  ContextKind,
  ContextTrustQuery,
  PublicContextTrust,
} from "../public-context-trust-contract";
class PublicContextTrustService {
  async page(
    kind: ContextKind,
    slug: string,
    filters: ContextTrustQuery = {},
  ): Promise<PublicContextTrust> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || slug.length > 200)
      throw new NotFoundError("Context");
    const result = await publicContextTrustRepository.page(kind, slug, filters.cursor);
    return {
      subject: {
        kind: result.subject.kind,
        slug: result.subject.slug,
        name: result.subject.name,
        createdAt: result.subject.createdAt.toISOString(),
        verified: result.subject.verified,
        publications: result.subject.publications,
        servers: result.subject.servers
          ? { total: result.subject.servers.total, verified: result.subject.servers.verified }
          : null,
        organization: result.subject.organization
          ? {
              slug: result.subject.organization.slug,
              name: result.subject.organization.name,
              verified: result.subject.organization.verified,
            }
          : null,
        ownershipKind: result.subject.ownershipKind,
      },
      items: result.items.map((row) => ({
        key: row.key,
        approvedAt: (row.approvedAt as Date).toISOString(),
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
        ? JSON.stringify({ ...result.nextCursor, context: result.context, version: 1 })
        : null,
    };
  }
}
export const publicContextTrustService = new PublicContextTrustService();
