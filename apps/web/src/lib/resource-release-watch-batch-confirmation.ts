import type { ResourceReleaseWatchDisableCommand } from "@nexus/domain";
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function confirmedResourceReleaseWatchBatch(
  value: unknown,
  command: ResourceReleaseWatchDisableCommand,
) {
  if (
    !record(value) ||
    Object.keys(value).length !== 2 ||
    !Array.isArray(value.items) ||
    value.items.length !== command.items.length ||
    (value.changedCount !== 0 && value.changedCount !== command.items.length)
  )
    return false;
  const rows = value.items;
  return command.items.every((requested, index) => {
    const row = rows[index];
    return (
      record(row) &&
      Object.keys(row).length === 4 &&
      row.productId === requested.productId &&
      row.enabled === false &&
      row.revision === requested.expectedRevision + 1 &&
      typeof row.updatedAt === "string" &&
      Number.isFinite(Date.parse(row.updatedAt)) &&
      new Date(row.updatedAt).toISOString() === row.updatedAt
    );
  });
}
