export const RESOURCE_RELEASE_WATCH_LIMIT = 100;
export const RESOURCE_RELEASE_WORKER_LIMIT = 100;
export type ResourceReleaseWatchCommand = { enabled: boolean; expectedRevision: number };
export type ResourceReleaseWatch = {
  productId: string;
  enabled: boolean;
  revision: number;
  updatedAt: Date | null;
};
export type ResourceReleaseNoticeData = {
  kind: "resource_release";
  resourceTitle: string;
  version: string;
};
export type ResourceReleaseWatchFilter = "all" | "enabled" | "disabled" | "unavailable";
export type ResourceReleaseWorkerResult = {
  examined: number;
  processed: number;
  notified: number;
  skipped: number;
  disabled: number;
  pushJobs: number;
  pushDegraded: number;
};

export const RESOURCE_RELEASE_WATCH_BATCH_LIMIT = 20;
export type ResourceReleaseWatchDisableCommand = {
  items: { productId: string; expectedRevision: number }[];
};
export type ResourceReleaseWatchBatchResult = {
  items: ResourceReleaseWatch[];
  changedCount: number;
};

export type ResourceReleaseWatchDisableResult = ResourceReleaseWatchBatchResult;
export type ResourceReleaseWatchEnableCommand = ResourceReleaseWatchDisableCommand & {
  expectedCollectionRevision: number;
};

/** Resume only reviewed, existing stopped watches; never enroll an unknown reference. */
export type ResourceReleaseWatchResumeCommand = ResourceReleaseWatchDisableCommand;
