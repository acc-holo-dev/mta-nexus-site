export function confirmedReview(value: unknown, revision: number, action: "save" | "withdraw") {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(row.id) &&
    row.status === (action === "save" ? "published" : "withdrawn") &&
    (row.revision === revision + 1 || (action === "withdraw" && row.revision === revision))
  );
}
export function confirmedReviewReport(value: unknown): value is { id: string; created: boolean } {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(row.id) &&
    typeof row.created === "boolean"
  );
}
export function confirmedReviewDecision(value: unknown, id: string, action: string) {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.id === id &&
    row.status ===
      (action === "review" ? "under_review" : action === "dismiss" ? "dismissed" : "resolved") &&
    row.reviewRemoved === (action === "remove_review")
  );
}
