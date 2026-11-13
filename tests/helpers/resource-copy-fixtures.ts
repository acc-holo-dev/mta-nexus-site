import type { ResourceCopyCommand, ResourceCopyMetadata } from "@nexus/domain";
export const metadata: ResourceCopyMetadata = {
  description: "Resource description",
  shortDescription: "Resource summary",
  type: "script",
  tags: ["roleplay"],
  compatibility: { mtaMinVersion: "1.6.0", dependencies: ["core"] },
};
export const command: ResourceCopyCommand = {
  requestId: "11111111-1111-4111-8111-111111111111",
  reviewDigest: "a".repeat(64),
  title: "New resource",
  slug: "new-resource",
};
export const date = new Date("2026-10-11T00:00:00.000Z");
export const sourceId = "prd_source",
  targetId = `prd_copy_${"b".repeat(64)}`,
  receiptId = `rcopy_${"b".repeat(64)}`;
export const receipt = {
  id: receiptId,
  createdAt: date,
  source: { id: sourceId, title: "Original resource" },
  target: {
    id: targetId,
    title: command.title,
    slug: command.slug,
    createdStatus: "draft" as const,
  },
  metadata,
};
export const preview = {
  source: {
    id: sourceId,
    title: "Original resource",
    slug: "original-resource",
    status: "published",
    updatedAt: date,
    scope: "personal" as const,
  },
  metadata,
  reviewDigest: command.reviewDigest,
};
