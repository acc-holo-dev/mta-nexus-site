import { auditRepository } from "@nexus/db";
import {
  SECURITY_ACTIVITY_ACTIONS,
  toSecurityActivityItem,
  type SecurityActivityItem,
} from "../security-activity";

export class SecurityCenterService {
  async listActivity(
    userId: string,
    limit = 30,
  ): Promise<SecurityActivityItem[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 30;
    const events = await auditRepository.listByActor(
      userId,
      [...SECURITY_ACTIVITY_ACTIONS],
      boundedLimit,
    );
    return events.flatMap((event) => {
      const safe = toSecurityActivityItem(event);
      return safe ? [safe] : [];
    });
  }
}

export const securityCenterService = new SecurityCenterService();
