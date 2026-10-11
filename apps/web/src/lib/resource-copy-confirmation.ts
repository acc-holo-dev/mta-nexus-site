import type { ResourceCopyCommand, ResourceCopyMetadata } from "@nexus/domain";
import { resourceCopyMetadataSchema } from "@nexus/validation";

const object = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
export function confirmedResourceCopy(
  value: unknown,
  sourceId: string,
  command: ResourceCopyCommand,
  expected: ResourceCopyMetadata,
): string | null {
  const body = object(value),
    receipt = object(body?.receipt),
    source = object(receipt?.source),
    target = object(receipt?.target);
  const metadata = resourceCopyMetadataSchema.safeParse(receipt?.metadata),
    expectedMetadata = resourceCopyMetadataSchema.safeParse(expected);
  if (
    typeof body?.replayed !== "boolean" ||
    typeof receipt?.id !== "string" ||
    !/^rcopy_[a-f0-9]{64}$/u.test(receipt.id) ||
    source?.id !== sourceId ||
    typeof target?.id !== "string" ||
    !/^prd_copy_[a-f0-9]{64}$/u.test(target.id) ||
    target.id === sourceId ||
    target.title !== command.title ||
    target.slug !== command.slug ||
    target.createdStatus !== "draft" ||
    typeof receipt.createdAt !== "string" ||
    !Number.isFinite(Date.parse(receipt.createdAt)) ||
    new Date(receipt.createdAt).toISOString() !== receipt.createdAt ||
    !metadata.success ||
    !expectedMetadata.success ||
    JSON.stringify(metadata.data) !== JSON.stringify(expectedMetadata.data)
  )
    return null;
  return target.id;
}
