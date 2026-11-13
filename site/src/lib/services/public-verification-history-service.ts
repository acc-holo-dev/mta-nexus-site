import { publicVerificationHistoryRepository } from "@nexus/db";
import { NotFoundError } from "@nexus/domain";
import type { ApprovalQuery, PublicApprovalPage } from "../public-verification-history-contract";
class PublicVerificationHistoryService {
  async page(username: string, filters: ApprovalQuery = {}): Promise<PublicApprovalPage> {
    if (!/^[a-zA-Z0-9_-]{1,80}$/u.test(username)) throw new NotFoundError("Profile");
    const result = await publicVerificationHistoryRepository.page(username, filters);
    return {
      subject: {
        username: result.subject.username,
        name: result.subject.name,
        identityVerified: result.subject.identityVerified,
        developerVerified: result.subject.developerVerified,
      },
      items: result.items.map((row) => ({
        key: row.key,
        type: row.type as "user" | "developer",
        approvedAt: (row.approvedAt as Date).toISOString(),
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
        ? JSON.stringify({ ...result.nextCursor, context: result.context, version: 1 })
        : null,
    };
  }
}
export const publicVerificationHistoryService = new PublicVerificationHistoryService();
