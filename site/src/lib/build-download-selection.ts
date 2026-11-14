/**
 * A pinned release is an opaque database build ID, never an archive path.
 * Validation here is not authorization: the server must still scope it by
 * product, current publication, trusted scan and the requester's rights.
 */
const BUILD_ID_PATTERN = /^bld_[A-Za-z0-9_-]{1,120}$/u;

export type DownloadBuildSelection =
  | Readonly<{ kind: "latest" }>
  | Readonly<{ kind: "pinned"; buildId: string }>
  | Readonly<{ kind: "invalid" }>;

export function validDownloadBuildId(value: unknown): value is string {
  return typeof value === "string" && BUILD_ID_PATTERN.test(value);
}

export function parseDownloadBuildSelection(
  params: Pick<URLSearchParams, "getAll">,
): DownloadBuildSelection {
  const ids = params.getAll("buildId");
  if (ids.length === 0) return { kind: "latest" };
  if (ids.length !== 1 || !validDownloadBuildId(ids[0])) {
    return { kind: "invalid" };
  }
  return { kind: "pinned", buildId: ids[0] };
}

/** Build the URL only from an explicitly validated, opaque build ID. */
export function resourceDownloadUrl(productId: string, buildId?: string): string {
  const url = `/api/products/${encodeURIComponent(productId)}/download`;
  if (buildId === undefined) return url;
  if (!validDownloadBuildId(buildId)) {
    throw new RangeError("Invalid resource build identifier");
  }
  return `${url}?buildId=${encodeURIComponent(buildId)}`;
}
