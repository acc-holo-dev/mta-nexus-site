import type { BuildScanStatus, BuildStatus } from "./entities";

export type ResourceBuildCommand =
  | { action: "save"; expectedRevision: number; releaseNotes: string; mtaVersionTarget: string }
  | { action: "withdraw" | "submit" | "retire"; expectedRevision: number; reason: string };

/** Private workspace projection. Storage locations and scanner credentials never leave the server. */
export interface ResourceBuildView {
  id: string;
  productId: string;
  version: string;
  status: BuildStatus;
  revision: number;
  releaseNotes: string | null;
  mtaVersionTarget: string | null;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  scanStatus: BuildScanStatus;
  scanner: string | null;
  scannedAt: Date | null;
  isSigned: boolean;
  createdAt: Date;
}

export function resourceBuildTargetStatus(
  status: BuildStatus,
  action: ResourceBuildCommand["action"],
): BuildStatus | null {
  if (action === "save" && (status === "draft" || status === "rejected")) return "draft";
  if (action === "submit" && (status === "draft" || status === "rejected")) return "pending_review";
  if (action === "withdraw" && status === "pending_review") return "draft";
  if (action === "retire" && status !== "retired" && status !== "quarantined") return "retired";
  return null;
}
