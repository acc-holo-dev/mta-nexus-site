/** A server receipt is not confirmation that a browser saved an archive. */
export const RESOURCE_DELIVERY_STATUSES = ["started", "served", "cancelled", "failed"] as const;
export type ResourceDeliveryStatus = (typeof RESOURCE_DELIVERY_STATUSES)[number];
export const RESOURCE_DELIVERY_ERRORS = [
  "storage_error",
  "size_mismatch",
  "hash_mismatch",
] as const;
export type ResourceDeliveryError = (typeof RESOURCE_DELIVERY_ERRORS)[number];
export type ResourceDeliveryFinish =
  | { status: "served" | "cancelled"; bytesSent: number; errorCode: null }
  | { status: "failed"; bytesSent: number; errorCode: ResourceDeliveryError };
export type ResourceDeliveryQuery = {
  status: "all" | ResourceDeliveryStatus;
  days: "all" | "7" | "30" | "90" | "365";
  resourceId: string | null;
  page: number;
};
export type ResourceDeliveryReceipt = {
  id: string;
  resourceId: string;
  buildId: string;
  version: string;
  sha256Hash: string;
  expectedBytes: number;
  bytesSent: number;
  status: ResourceDeliveryStatus;
  errorCode: ResourceDeliveryError | null;
  pinned: boolean;
  startedAt: Date;
  finishedAt: Date | null;
  title: string | null;
  downloadable: boolean;
};
