import { AppError, type LibraryCollectionInventoryRelease } from "@nexus/domain";

export type InventoryReleaseRow = {
  available: boolean;
  mode: string;
  revision: number;
  canReviewRequirements: boolean;
  state: string;
  latestBuildId: string | null;
  latestVersion: string | null;
  selectedBuildId: string | null;
  selectedVersion: string | null;
};
const invalid = () => new AppError("Invalid release snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
function build(id: string | null, version: string | null) {
  if (id === null && version === null) return null;
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(id) ||
    typeof version !== "string" ||
    !version.length ||
    version.length > 128 ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject corrupt private metadata.
    /[\u0000-\u001f\u007f]/u.test(version)
  )
    throw invalid();
  return { buildId: id, version };
}
/** Explicit DTO. Inaccessible preference/build metadata is withheld, including on corrupt input. */
export function inventoryReleaseSnapshot(
  row: InventoryReleaseRow,
): LibraryCollectionInventoryRelease | null {
  if (row.available === false) return null;
  if (
    row.available !== true ||
    typeof row.canReviewRequirements !== "boolean" ||
    !["latest", "fixed"].includes(row.mode) ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    row.revision > 2147483647 ||
    (row.mode === "fixed" && row.revision === 0)
  )
    throw invalid();
  const latest = build(row.latestBuildId, row.latestVersion);
  if (!latest) throw invalid();
  const effective =
    row.mode === "latest" ? latest : build(row.selectedBuildId, row.selectedVersion);
  const state =
    row.mode === "latest"
      ? "latest"
      : !effective
        ? "selection_unavailable"
        : effective.buildId === latest.buildId
          ? "pinned"
          : "update_available";
  if (row.state !== state || (state === "pinned" && effective?.version !== latest.version))
    throw invalid();
  return {
    state,
    mode: row.mode as "latest" | "fixed",
    revision: row.revision,
    canReviewRequirements: row.canReviewRequirements,
    latest,
    effective,
  };
}
