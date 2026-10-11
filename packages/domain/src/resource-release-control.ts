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
  | { mode: "fixed"; buildId: string }
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
};
