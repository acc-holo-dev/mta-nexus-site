export function confirmedServerReview(
  value: unknown,
  expectedRevision: number,
  action: "save" | "withdraw",
): value is { id: string; revision: number; status: string; success?: boolean } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (typeof body.id !== "string" || !body.id) return false;
  if (!Number.isSafeInteger(body.revision) || (body.revision as number) <= expectedRevision)
    return false;
  if (action === "save" && body.status !== "published") return false;
  if (action === "withdraw" && body.status !== "withdrawn") return false;
  return true;
}
