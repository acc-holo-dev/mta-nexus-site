const PLAYER_FLOORS = new Set([0, 1, 10, 50, 100]);

export type DirectoryListQuery = {
  query: string;
  minimumPlayers: number;
  page: number;
};

export function parseDirectoryListQuery(search: string): DirectoryListQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const minRaw = Number(params.get("min"));
  const minimumPlayers = PLAYER_FLOORS.has(minRaw) ? minRaw : 0;
  const pageRaw = Number(params.get("page"));
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw - 1 : 0;
  return { query, minimumPlayers, page };
}

/** Keep unrelated params. `page` in the URL is 1-based; page 0 is omitted. */
export function applyDirectoryListQuery(
  currentSearch: string,
  filters: DirectoryListQuery,
): string {
  const params = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  const query = filters.query.trim().slice(0, 100);
  if (query) params.set("q", query);
  else params.delete("q");
  if (filters.minimumPlayers > 0) params.set("min", String(filters.minimumPlayers));
  else params.delete("min");
  if (filters.page > 0) params.set("page", String(filters.page + 1));
  else params.delete("page");
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
