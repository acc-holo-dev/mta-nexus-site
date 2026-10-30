import type { AuditEvent, Build } from "@nexus/domain";
import * as buildLifecycle from "./builds-lifecycle";
import * as buildModeration from "./builds-moderation";
import * as buildQueries from "./builds-queries";
import type { PendingReviewBuild, RiskReviewBuild } from "./builds-types";

export type { PendingReviewBuild, RiskReviewBuild } from "./builds-types";

/**
 * Resource build persistence facade. Query, moderation and lifecycle mutations
 * live in focused modules so upload, review and retirement can change separately
 * while sharing build-safety and product authority contracts.
 */
export class BuildRepository {
  findExactPendingRetry(
    input: Parameters<typeof buildQueries.findExactPendingRetry>[0],
  ): Promise<Build | null> {
    return buildQueries.findExactPendingRetry(input);
  }

  pageHistory(productId: string, requestedPage = 1) {
    return buildQueries.pageHistory(productId, requestedPage);
  }

  countPendingReview(): Promise<number> {
    return buildQueries.countPendingReview();
  }

  listPendingReviewPage(
    page: number,
    pageSize = 30,
  ): Promise<{ builds: PendingReviewBuild[]; hasMore: boolean }> {
    return buildQueries.listPendingReviewPage(page, pageSize);
  }

  listRiskReviewPage(
    page: number,
    pageSize = 30,
  ): Promise<{ builds: RiskReviewBuild[]; hasMore: boolean }> {
    return buildQueries.listRiskReviewPage(page, pageSize);
  }

  countQuarantined(): Promise<number> {
    return buildQueries.countQuarantined();
  }

  listByProduct(productId: string): Promise<Build[]> {
    return buildQueries.listByProduct(productId);
  }

  listPendingReview(limit = 100): Promise<Build[]> {
    return buildQueries.listPendingReview(limit);
  }

  listPublishedByProduct(productId: string): Promise<Build[]> {
    return buildQueries.listPublishedByProduct(productId);
  }

  findById(id: string): Promise<Build | null> {
    return buildQueries.findById(id);
  }

  pagePublishedReleases(productId: string, requestedPage = 1) {
    return buildQueries.pagePublishedReleases(productId, requestedPage);
  }

  findPublishedByProductAndId(productId: string, buildId: string): Promise<Build | null> {
    return buildQueries.findPublishedByProductAndId(productId, buildId);
  }

  findLatestPublishedByProduct(productId: string): Promise<Build | null> {
    return buildQueries.findLatestPublishedByProduct(productId);
  }

  updateStatus(
    id: string,
    status: Build["status"],
    expectedStatus?: Build["status"],
  ): Promise<Build | null> {
    return buildQueries.updateStatus(id, status, expectedStatus);
  }

  submitForReview(
    data: Omit<Build, "createdAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Build> {
    return buildModeration.submitForReview(data, audit);
  }

  moderatePending(
    id: string,
    decision: "approve" | "reject",
    audit: Omit<AuditEvent, "createdAt">,
    expectedRevision: number,
    currentToken: string,
  ): Promise<Build | null> {
    return buildModeration.moderatePending(id, decision, audit, expectedRevision, currentToken);
  }

  retireAndRefreshProduct(
    id: string,
    expectedStatus: Build["status"],
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Build | null> {
    return buildLifecycle.retireAndRefreshProduct(id, expectedStatus, audit);
  }

  quarantinePublishedAndRefreshProduct(
    id: string,
    actorId: string,
    reason: string,
    audit: Omit<AuditEvent, "createdAt">,
    currentToken: string,
  ): Promise<Build | null> {
    return buildLifecycle.quarantinePublishedAndRefreshProduct(
      id,
      actorId,
      reason,
      audit,
      currentToken,
    );
  }

  restoreQuarantinedAndRefreshProduct(
    id: string,
    audit: Omit<AuditEvent, "createdAt">,
    currentToken: string,
  ): Promise<Build | null> {
    return buildLifecycle.restoreQuarantinedAndRefreshProduct(id, audit, currentToken);
  }

  create(data: Omit<Build, "createdAt">): Promise<Build> {
    return buildQueries.create(data);
  }
}

export const buildRepository = new BuildRepository();
