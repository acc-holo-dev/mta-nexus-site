import type { ProductStatus } from "./entities";

export const LIBRARY_RELEASE_FILTERS = ["all", "updates", "pinned", "unavailable"] as const;
export type LibraryReleaseFilter = (typeof LIBRARY_RELEASE_FILTERS)[number];
export type LibraryReleaseState =
  | "latest"
  | "pinned"
  | "update_available"
  | "selection_unavailable"
  | "unavailable";
export type LibraryReleaseSelection = {
  revision: number;
  mode: "latest" | "fixed";
  buildId: string | null;
  updatedAt: Date | null;
};
export type LibraryReleaseCommand = { expectedRevision: number } & (
  | { mode: "latest" }
  | {
      mode: "fixed";
      buildId: string;
      reviewedArtifact?: { sha256Hash: string; fileSizeBytes: number };
    }
);
export type ResourceModerationCommand = {
  action: "suspend" | "release";
  expectedUpdatedAt: string;
  reason: string;
};
export function resourceModerationTarget(
  status: ProductStatus,
  action: ResourceModerationCommand["action"],
): "suspended" | "draft" | null {
  if (action === "release") return status === "suspended" ? "draft" : null;
  return status === "draft" ||
    status === "pending_review" ||
    status === "published" ||
    status === "archived"
    ? "suspended"
    : null;
}

/** Staff moderation actions allowed for the current resource status. */
export function resourceModerationActionsFor(
  status: ProductStatus,
): ResourceModerationCommand["action"][] {
  const actions: ResourceModerationCommand["action"][] = [];
  if (resourceModerationTarget(status, "suspend")) actions.push("suspend");
  if (resourceModerationTarget(status, "release")) actions.push("release");
  return actions;
}

export type BuildAvailabilityKind =
  | "available"
  | "quarantined"
  | "retired"
  | "draft"
  | "pending_review"
  | "unavailable";

export function classifyBuildAvailability(
  status: string | null | undefined,
): BuildAvailabilityKind {
  if (status === "published") return "available";
  if (status === "quarantined") return "quarantined";
  if (status === "retired") return "retired";
  if (status === "draft") return "draft";
  if (status === "pending_review") return "pending_review";
  return "unavailable";
}

/** Filter-safe support entry; stash product/build ids separately for the form. */
export function unavailableBuildSupportHref(): string {
  return "/support?category=resource";
}

export type LibraryReleaseItem = {
  productId: string;
  addedAt: Date;
  hasAccess: boolean;
  revision: number;
  mode: "latest" | "fixed";
  title: string | null;
  slug: string | null;
  latestBuildId: string | null;
  latestVersion: string | null;
  selectedBuildId: string | null;
  selectedVersion: string | null;
  state: LibraryReleaseState;
  /** Account release-watch posture; revision 0 means no saved watch row yet. */
  watchEnabled: boolean;
  watchRevision: number;
  watchUpdatedAt: Date | null;
};
