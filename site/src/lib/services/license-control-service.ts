import {
  licenseControlsRepository,
  licenseRepository,
  licenseMaintenanceRepository,
} from "@nexus/db";
import { can, createLicenseRuntimeToken, generateId } from "@nexus/security";
import { ForbiddenError, type User, type LicenseArchiveFilter } from "@nexus/domain";
import type { LicenseOwnerCommand, LicenseModerationCommand } from "@nexus/validation";

export const licenseControlService = {
  archive: (user: User, query: LicenseArchiveFilter & { page: number }) =>
    licenseRepository.pageUserHistory(user.id, query.page, query),
  async maintenance(user: User, page = 1) {
    if (user.role !== "admin") throw new ForbiddenError();
    return licenseMaintenanceRepository.preview(user.id, page);
  },
  detail: (user: User, licenseId: string) => licenseControlsRepository.detail(licenseId, user.id),
  servers: (user: User, licenseId: string, page = 1) =>
    licenseControlsRepository.eligibleServers(licenseId, user.id, page),
  releases: (user: User, licenseId: string, page = 1) =>
    licenseControlsRepository.releasePage(licenseId, user.id, page),
  async history(user: User, licenseId: string, page = 1, moderation = false) {
    if (moderation && !can(user, "admin.moderation")) throw new ForbiddenError();
    return licenseControlsRepository.historyPage(licenseId, user.id, moderation, page);
  },
  async ownerCommand(
    user: User,
    licenseId: string,
    command: LicenseOwnerCommand,
    currentToken: string,
  ) {
    const token = command.action === "rotate_token" ? createLicenseRuntimeToken() : undefined;
    const result = await licenseControlsRepository.ownerCommand({
      licenseId,
      actorId: user.id,
      currentToken,
      command,
      auditId: generateId("aud"),
      tokenDigest: token?.digest,
    });
    return {
      license: result.license,
      ...(result.binding ? { binding: result.binding } : {}),
      ...(token && result.tokenExpiresAt
        ? {
            token: { value: token.value, expiresAt: result.tokenExpiresAt.toISOString() },
          }
        : {}),
    };
  },
  async moderationPage(user: User, page = 1, status?: string, query = "") {
    if (!can(user, "admin.moderation")) throw new ForbiddenError();
    return licenseControlsRepository.moderationPage(user.id, page, status, query);
  },
  async moderationDetail(user: User, licenseId: string) {
    if (!can(user, "admin.moderation")) throw new ForbiddenError();
    return licenseControlsRepository.detail(licenseId, user.id, true);
  },
  async moderate(
    user: User,
    licenseId: string,
    command: LicenseModerationCommand,
    currentToken: string,
  ) {
    if (!can(user, "admin.moderation")) throw new ForbiddenError();
    return licenseControlsRepository.moderate({
      licenseId,
      actorId: user.id,
      currentToken,
      command,
      auditId: generateId("aud"),
    });
  },
};
