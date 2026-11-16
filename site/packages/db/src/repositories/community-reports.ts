import type {
  ChangeHistoryFilters,
  CommunityReportGroupFilters,
  ReportHistoryGroup,
} from "@nexus/domain";
import * as reportDecisions from "./community-reports-decisions";
import * as reportQueries from "./community-reports-queries";
import * as reportSubmit from "./community-reports-submit";
import type { BatchInput, Scope } from "./community-reports-types";

/**
 * Community report persistence facade. Queue/history reads, complaint submit,
 * and decision (single + batch) live in focused modules while sharing scope,
 * staff checks, audit and notification helpers.
 */
class CommunityReportsRepository {
  groups(actorId: string, filters: CommunityReportGroupFilters) {
    return reportQueries.groups(actorId, filters);
  }

  publicationReports(
    actorId: string,
    contentId: string,
    filters: { view: "pending" | "history"; query: string; type?: string; page: number },
  ) {
    return reportQueries.publicationReports(actorId, contentId, filters);
  }

  history(scope: Scope, id: string, filters: ChangeHistoryFilters<ReportHistoryGroup>) {
    return reportQueries.history(scope, id, filters);
  }

  previewDiscussionBatch(actorId: string, contentId: string, commentId: string, input: BatchInput) {
    return reportDecisions.previewDiscussionBatch(actorId, contentId, commentId, input);
  }

  decideDiscussionBatch(
    actorId: string,
    contentId: string,
    commentId: string,
    input: BatchInput & { previewRevision: string },
    auditIds: string[],
    currentToken: string,
  ) {
    return reportDecisions.decideDiscussionBatch(
      actorId,
      contentId,
      commentId,
      input,
      auditIds,
      currentToken,
    );
  }

  previewPublicationBatch(actorId: string, contentId: string, input: BatchInput) {
    return reportDecisions.previewPublicationBatch(actorId, contentId, input);
  }

  decidePublicationBatch(
    actorId: string,
    contentId: string,
    input: BatchInput & { previewRevision: string },
    auditIds: string[],
    currentToken: string,
  ) {
    return reportDecisions.decidePublicationBatch(
      actorId,
      contentId,
      input,
      auditIds,
      currentToken,
    );
  }

  submit(input: Parameters<typeof reportSubmit.submit>[0]) {
    return reportSubmit.submit(input);
  }

  page(
    scope: Scope,
    filters: {
      view: "pending" | "history";
      page: number;
      target?: "content" | "comment";
      type?: string;
      query?: string;
    },
  ) {
    return reportQueries.page(scope, filters);
  }

  detail(scope: Scope, id: string) {
    return reportQueries.detail(scope, id);
  }

  decide(input: Parameters<typeof reportDecisions.decide>[0]) {
    return reportDecisions.decide(input);
  }
}

export const communityReportsRepository = new CommunityReportsRepository();
