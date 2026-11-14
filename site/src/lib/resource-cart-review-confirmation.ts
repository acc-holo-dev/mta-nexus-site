import type { ResourceCartReview } from "@nexus/domain";
import { confirmedResourceCart } from "./resource-commerce-confirmation";
export function confirmedResourceCartReview(value: unknown): ResourceCartReview | null {
  if (!value || typeof value !== "object") return null;
  const row = value as ResourceCartReview;
  if (
    !confirmedResourceCart(row) ||
    (row.reviewDigest !== null &&
      (typeof row.reviewDigest !== "string" || !/^[a-f0-9]{64}$/u.test(row.reviewDigest)))
  )
    return null;
  if (
    (row.items.length > 0 && row.items.every((item) => item.available)) !==
    (row.reviewDigest !== null)
  )
    return null;
  for (const item of row.items) {
    if (!item.available) {
      if (
        [
          item.buildId,
          item.sha256Hash,
          item.fileSizeBytes,
          item.mtaMinVersion,
          item.dependencies,
        ].some((field) => field !== null)
      )
        return null;
    } else if (
      typeof item.buildId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(item.buildId) ||
      typeof item.sha256Hash !== "string" ||
      !/^[a-f0-9]{64}$/u.test(item.sha256Hash) ||
      typeof item.fileSizeBytes !== "number" ||
      !Number.isSafeInteger(item.fileSizeBytes) ||
      item.fileSizeBytes < 1 ||
      item.fileSizeBytes > 67108864 ||
      (item.mtaMinVersion !== null &&
        (typeof item.mtaMinVersion !== "string" || item.mtaMinVersion.length > 40)) ||
      !Array.isArray(item.dependencies) ||
      item.dependencies.length > 25 ||
      item.dependencies.some(
        (dependency) =>
          typeof dependency !== "string" || !/^[a-z0-9][a-z0-9._-]{2,119}$/u.test(dependency),
      )
    )
      return null;
  }
  return row;
}
