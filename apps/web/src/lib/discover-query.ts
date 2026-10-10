export const DISCOVER_TYPES = [
  "servers",
  "resources",
  "creators",
  "organizations",
  "content",
] as const;
export type DiscoverType = (typeof DISCOVER_TYPES)[number];
export const DISCOVER_CONTENT_TYPES = [
  "article",
  "devlog",
  "announcement",
  "review",
  "post",
  "question",
  "news",
  "update",
] as const;
export type DiscoverQuery = {
  type: DiscoverType;
  query: string;
  page: number;
  verified: boolean;
  sort: "newest" | "name";
  language: string;
  region: string;
  gameMode: string;
  contentType: "" | (typeof DISCOVER_CONTENT_TYPES)[number];
};
type Input = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
export function parseDiscoverQuery(input: Input): DiscoverQuery {
  const requested = first(input.type);
  const type = DISCOVER_TYPES.includes(requested as DiscoverType)
    ? (requested as DiscoverType)
    : "servers";
  const rawPage = first(input.page) ?? "1";
  const page = /^\d{1,4}$/u.test(rawPage) ? Math.min(Math.max(Number(rawPage), 1), 1000) : 1;
  const text = (key: string, limit = 60) => (first(input[key]) ?? "").trim().slice(0, limit);
  const requestedContent = first(input.contentType);
  return {
    type,
    query: text("q", 100),
    page,
    verified:
      ["servers", "creators", "organizations"].includes(type) && first(input.verified) === "1",
    sort:
      first(input.sort) === "name" && ["servers", "creators", "organizations"].includes(type)
        ? "name"
        : "newest",
    language: type === "servers" ? text("language") : "",
    region: type === "servers" ? text("region") : "",
    gameMode: type === "servers" ? text("gameMode") : "",
    contentType:
      type === "content" &&
      DISCOVER_CONTENT_TYPES.includes(requestedContent as (typeof DISCOVER_CONTENT_TYPES)[number])
        ? (requestedContent as (typeof DISCOVER_CONTENT_TYPES)[number])
        : "",
  };
}
export function parseDiscoverApiQuery(params: URLSearchParams): DiscoverQuery | null {
  const input: Input = {};
  for (const key of [
    "type",
    "q",
    "page",
    "verified",
    "sort",
    "language",
    "region",
    "gameMode",
    "contentType",
  ]) {
    const values = params.getAll(key);
    if (values.length > 1) return null;
    input[key] = values[0];
  }
  if (input.type && !DISCOVER_TYPES.includes(input.type as DiscoverType)) return null;
  if (input.page && (!/^[1-9]\d{0,3}$/u.test(input.page as string) || Number(input.page) > 1000))
    return null;
  if (input.verified && input.verified !== "1") return null;
  if (input.sort && !["newest", "name"].includes(input.sort as string)) return null;
  if (
    input.contentType &&
    !DISCOVER_CONTENT_TYPES.includes(input.contentType as (typeof DISCOVER_CONTENT_TYPES)[number])
  )
    return null;
  for (const [key, max] of [
    ["q", 100],
    ["language", 60],
    ["region", 60],
    ["gameMode", 60],
  ] as const)
    if ((input[key] as string | undefined)?.length && (input[key] as string).length > max)
      return null;
  return parseDiscoverQuery(input);
}
export function discoverHref(
  input: { type: DiscoverType; query?: string } & Partial<Omit<DiscoverQuery, "type" | "query">>,
  path = "/discover",
): string {
  const state = parseDiscoverQuery({
    type: input.type,
    q: input.query,
    page: String(input.page ?? 1),
    verified: input.verified ? "1" : undefined,
    sort: input.sort,
    language: input.language,
    region: input.region,
    gameMode: input.gameMode,
    contentType: input.contentType,
  });
  const params = new URLSearchParams();
  if (path === "/discover") params.set("type", state.type);
  if (state.query) params.set("q", state.query);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.verified) params.set("verified", "1");
  if (state.sort === "name") params.set("sort", state.sort);
  for (const key of ["language", "region", "gameMode", "contentType"] as const)
    if (state[key]) params.set(key, state[key]);
  return params.size ? `${path}?${params}` : path;
}
