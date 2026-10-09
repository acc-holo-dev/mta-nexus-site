import type { MtaMasterServer } from "./services/mta-master-directory-service";

// A master-list array represents one immutable upstream snapshot. Reuse only
// computed search strings for that snapshot; WeakMap lets replaced snapshots be
// garbage-collected without introducing process-wide invalidation or timers.
const normalizedSearchSnapshots = new WeakMap<
  readonly MtaMasterServer[],
  Array<string | undefined>
>();

function getSearchStrings(servers: readonly MtaMasterServer[]): Array<string | undefined> {
  let searchStrings = normalizedSearchSnapshots.get(servers);
  if (!searchStrings) {
    searchStrings = new Array<string | undefined>(servers.length);
    normalizedSearchSnapshots.set(servers, searchStrings);
  }
  return searchStrings;
}

// Pagination and player limits are validated by the directory API schema.
export function selectMtaDirectoryPage(
  servers: readonly MtaMasterServer[],
  {
    query,
    minPlayers,
    limit,
    offset,
  }: {
    query?: string;
    minPlayers: number;
    limit: number;
    offset: number;
  },
) {
  const term = query?.toLocaleLowerCase();
  // Master-list player counts are unsigned; missing counts mean zero here.
  if (!term && minPlayers === 0) {
    return { servers: servers.slice(offset, offset + limit), total: servers.length };
  }

  // Do not allocate any search strings for a player-count-only filter.
  const searchStrings = term ? getSearchStrings(servers) : null;
  const page: MtaMasterServer[] = [];
  let total = 0;
  for (let index = 0; index < servers.length; index++) {
    const server = servers[index];
    if ((server.players ?? 0) < minPlayers) continue;
    if (term && searchStrings) {
      const searchable = searchStrings[index] ?? [
        server.name, server.address, server.gameMode, server.mapName, server.version,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      searchStrings[index] = searchable;
      if (!searchable.includes(term)) continue;
    }

    if (total >= offset && page.length < limit) page.push(server);
    total++;
  }
  // Count every match, but retain only the requested page.
  return { servers: page, total };
}
