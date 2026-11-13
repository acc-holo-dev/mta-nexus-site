import type { BuildScanStatus, BuildStatus, ProductStatus } from "./entities";
import type { ResourceReadiness } from "./resource-publisher";

export const RESOURCE_PUBLICATION_READINESS_ITEMS = [
  "description",
  "media",
  "build",
  "scan",
  "moderation",
  "compatibility",
] as const;

export type ResourcePublicationReadinessItemId =
  (typeof RESOURCE_PUBLICATION_READINESS_ITEMS)[number];

export type ResourcePublicationReadinessTier = "required" | "recommendation";

export type ResourcePublicationReadinessItemState =
  | "complete"
  | "blocked"
  | "pending"
  | "not_applicable";

export type ResourcePublicationReadinessBuild = {
  id: string;
  version: string;
  status: BuildStatus;
  scanStatus: BuildScanStatus;
  scanner: string | null;
  scannedAt: string | null;
};

export type ResourcePublicationReadinessInput = {
  productId: string;
  productStatus: ProductStatus;
  metadataReviewRequired: boolean;
  title: string;
  description: string;
  shortDescription: string;
  hasCompatibilityMetadata: boolean;
  mediaCount: number;
  submitCandidate: ResourcePublicationReadinessBuild | null;
  latestBuild: ResourcePublicationReadinessBuild | null;
};

export type ResourcePublicationReadinessItem = {
  id: ResourcePublicationReadinessItemId;
  tier: ResourcePublicationReadinessTier;
  state: ResourcePublicationReadinessItemState;
  detailKey: string;
  actionPath: string;
};

export type ResourcePublicationReadinessSummary = {
  productId: string;
  productStatus: ProductStatus;
  metadataReviewRequired: boolean;
  inventoryReadiness: ResourceReadiness;
  canSubmitForReview: boolean;
  items: ResourcePublicationReadinessItem[];
};

const DESCRIPTION_TITLE_MIN = 3;
const DESCRIPTION_BODY_MIN = 10;

export function hasTrustedCleanScan(
  build: Pick<ResourcePublicationReadinessBuild, "scanStatus" | "scanner" | "scannedAt">,
): boolean {
  return (
    build.scanStatus === "clean" &&
    typeof build.scanner === "string" &&
    build.scanner.trim().length > 0 &&
    typeof build.scannedAt === "string" &&
    Number.isFinite(Date.parse(build.scannedAt))
  );
}

function descriptionComplete(input: ResourcePublicationReadinessInput): boolean {
  return (
    input.title.trim().length >= DESCRIPTION_TITLE_MIN &&
    input.description.trim().length >= DESCRIPTION_BODY_MIN
  );
}

function inventoryReadiness(input: ResourcePublicationReadinessInput): ResourceReadiness {
  if (input.productStatus === "archived" || input.productStatus === "suspended") {
    return "restricted";
  }
  if (input.productStatus === "pending_review") return "in_review";
  if (
    input.productStatus === "published" &&
    !input.metadataReviewRequired &&
    input.submitCandidate &&
    input.submitCandidate.status === "published" &&
    hasTrustedCleanScan(input.submitCandidate)
  ) {
    return "published";
  }
  if (
    input.productStatus === "draft" &&
    input.submitCandidate &&
    hasTrustedCleanScan(input.submitCandidate)
  ) {
    return "ready";
  }
  if (!input.latestBuild) return "no_build";
  return "needs_version";
}

function scanDetailKey(build: ResourcePublicationReadinessBuild | null): string {
  if (!build) return "missing_build";
  if (hasTrustedCleanScan(build)) return "clean";
  if (build.scanStatus === "malicious") return "malicious";
  if (build.scanStatus === "error") return "error";
  return "awaiting";
}

function moderationDetailKey(
  input: ResourcePublicationReadinessInput,
  canSubmitForReview: boolean,
): string {
  if (input.productStatus === "archived") return "archived";
  if (input.productStatus === "suspended") return "suspended";
  if (input.productStatus === "pending_review") return "in_review";
  if (input.productStatus === "published" && input.metadataReviewRequired) {
    return "metadata_review";
  }
  if (input.productStatus === "published") return "published";
  if (input.latestBuild?.status === "rejected") return "build_rejected";
  if (canSubmitForReview) return "awaiting_submit";
  return "not_submitted";
}

function moderationState(
  input: ResourcePublicationReadinessInput,
  canSubmitForReview: boolean,
): ResourcePublicationReadinessItemState {
  if (input.productStatus === "archived" || input.productStatus === "suspended") {
    return "blocked";
  }
  if (input.productStatus === "pending_review") return "pending";
  if (input.productStatus === "published" && input.metadataReviewRequired) return "pending";
  if (input.productStatus === "published") return "complete";
  if (input.latestBuild?.status === "rejected") return "pending";
  if (canSubmitForReview) return "pending";
  return "complete";
}

export function buildResourcePublicationReadiness(
  input: ResourcePublicationReadinessInput,
): ResourcePublicationReadinessSummary {
  const base = `/workspace/resources/${encodeURIComponent(input.productId)}`;
  const buildFocus = input.submitCandidate ?? input.latestBuild;
  const scanTarget = buildFocus
    ? `${base}/builds/${encodeURIComponent(buildFocus.id)}`
    : `${base}#author-resource-version`;

  const canSubmitForReview =
    input.productStatus === "draft" &&
    descriptionComplete(input) &&
    Boolean(input.submitCandidate && hasTrustedCleanScan(input.submitCandidate));

  const items: ResourcePublicationReadinessItem[] = [
    {
      id: "description",
      tier: "required",
      state: descriptionComplete(input) ? "complete" : "blocked",
      detailKey: descriptionComplete(input) ? "complete" : "incomplete",
      actionPath: `${base}#author-resource-details`,
    },
    {
      id: "media",
      tier: "recommendation",
      state: input.mediaCount > 0 ? "complete" : "pending",
      detailKey: input.mediaCount > 0 ? "present" : "empty",
      actionPath: `${base}/media`,
    },
    {
      id: "build",
      tier: "required",
      state: input.latestBuild ? "complete" : "blocked",
      detailKey: input.latestBuild ? "present" : "missing",
      actionPath: `${base}#author-resource-version`,
    },
    {
      id: "scan",
      tier: "required",
      state: !buildFocus
        ? "blocked"
        : hasTrustedCleanScan(buildFocus)
          ? "complete"
          : buildFocus.scanStatus === "malicious" || buildFocus.scanStatus === "error"
            ? "blocked"
            : "pending",
      detailKey: scanDetailKey(buildFocus),
      actionPath: scanTarget,
    },
    {
      id: "moderation",
      tier: "required",
      state: moderationState(input, canSubmitForReview),
      detailKey: moderationDetailKey(input, canSubmitForReview),
      actionPath:
        input.productStatus === "pending_review" ||
        input.latestBuild?.status === "rejected" ||
        input.productStatus === "suspended"
          ? `${base}/moderation`
          : `${base}#author-resource-lifecycle`,
    },
    {
      id: "compatibility",
      tier: "recommendation",
      state: input.hasCompatibilityMetadata ? "complete" : "pending",
      detailKey: input.hasCompatibilityMetadata ? "present" : "optional",
      actionPath: `${base}/compatibility`,
    },
  ];

  return {
    productId: input.productId,
    productStatus: input.productStatus,
    metadataReviewRequired: input.metadataReviewRequired,
    inventoryReadiness: inventoryReadiness(input),
    canSubmitForReview,
    items,
  };
}
