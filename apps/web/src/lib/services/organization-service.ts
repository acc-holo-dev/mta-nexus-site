import { organizationRepository } from "@nexus/db";
import type { Organization } from "@nexus/domain";

export class OrganizationService {
  async listOrganizations(limit = 24): Promise<Organization[]> {
    return organizationRepository.listAll(Math.min(Math.max(Math.floor(limit), 1), 100));
  }

  async searchOrganizations(query: string, limit = 24): Promise<Organization[]> {
    return organizationRepository.searchPublic(query, limit);
  }
}

export const organizationService = new OrganizationService();
