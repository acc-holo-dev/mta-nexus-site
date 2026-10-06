export const DISCOVER_TYPES = [
  "servers",
  "resources",
  "creators",
  "organizations",
  "content",
] as const;

export type DiscoverType = (typeof DISCOVER_TYPES)[number];

const DEFAULT_DISCOVER_TYPE: DiscoverType = "servers";
const MAX_DISCOVER_QUERY_LENGTH = 100;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDiscoverQuery(input: {
  type?: string | string[];
  q?: string | string[];
}): { type: DiscoverType; query: string } {
  const requestedType = first(input.type);
  const type = DISCOVER_TYPES.includes(requestedType as DiscoverType)
    ? (requestedType as DiscoverType)
    : DEFAULT_DISCOVER_TYPE;
  const query = (first(input.q) ?? "").trim().slice(0, MAX_DISCOVER_QUERY_LENGTH);
  return { type, query };
}

export function discoverHref(input: {
  type: DiscoverType;
  query?: string;
}): string {
  const params = new URLSearchParams({ type: input.type });
  const query = input.query?.trim();
  if (query) params.set("q", query.slice(0, MAX_DISCOVER_QUERY_LENGTH));
  return `/discover?${params.toString()}`;
}
