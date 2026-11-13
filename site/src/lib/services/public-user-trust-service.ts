import { publicUserTrustRepository } from "@nexus/db";
import { NotFoundError } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import type { PublicUserTrust } from "../public-user-trust-contract";
const iso = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();
class PublicUserTrustService {
  async get(username: string): Promise<PublicUserTrust> {
    if (!/^[a-zA-Z0-9_-]{1,80}$/u.test(username)) throw new NotFoundError("Profile");
    const row = await publicUserTrustRepository.find(username);
    if (!row) throw new NotFoundError("Profile");
    return {
      user: {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: safeExternalWebUrl(row.avatarUrl) ?? null,
        joinedAt: new Date(row.joinedAt).toISOString(),
      },
      identity: {
        verified: row.identityVerified,
        latestRecordedApprovalAt: row.identityVerified ? iso(row.identityApprovalAt) : null,
      },
      developer: {
        verified: row.developerVerified,
        latestRecordedApprovalAt: row.developerVerified ? iso(row.developerApprovalAt) : null,
      },
      servers: { total: row.servers, verified: row.verifiedServers },
      organizations: { total: row.organizations, verified: row.verifiedOrganizations },
      publications: row.publications,
    };
  }
}
export const publicUserTrustService = new PublicUserTrustService();
