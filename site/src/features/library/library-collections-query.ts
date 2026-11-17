import { AppError } from "@nexus/domain";
import { libraryCollectionIdSchema } from "@nexus/validation";

const invalid = () => new AppError("Invalid collection request", 400, "COLLECTION_INVALID");
export function collectionId(value: string) {
  const parsed = libraryCollectionIdSchema.safeParse(value);
  if (!parsed.success) throw invalid();
  return parsed.data;
}
export function collectionsQuery(
  params: URLSearchParams,
  kind: "list" | "detail" | "history" = "list",
) {
  const allowed =
    kind === "list" ? ["page", "status"] : kind === "detail" ? ["page", "q"] : ["page"];
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw invalid();
  const page = params.get("page") ?? "1",
    status = params.get("status") ?? "active",
    q = params.get("q") ?? "";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in private search.
  const hasControls = /[\u0000-\u001f\u007f]/u.test(q);
  if (
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !["all", "active", "archived"].includes(status) ||
    q.length > 80 ||
    hasControls
  )
    throw invalid();
  return { page: Number(page), status: status as "all" | "active" | "archived", q: q.trim() };
}
export function collectionPageParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) throw invalid();
    if (value !== undefined) params.set(key, value);
  }
  return params;
}
export function collectionHref(id?: string, section = "", query: Record<string, string> = {}) {
  return `/workspace/library/collections${id ? `/${encodeURIComponent(id)}` : ""}${section ? `/${section}` : ""}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`;
}
