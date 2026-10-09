import type { MtaMasterServer } from "./services/mta-master-directory-service";

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

  const page: MtaMasterServer[] = [];
  let total = 0;
  for (const server of servers) {
    if ((server.players ?? 0) < minPlayers) continue;
    if (
      term &&
      ![server.name, server.address, server.gameMode, server.mapName, server.version]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(term)
    )
      continue;

    if (total >= offset && page.length < limit) page.push(server);
    total++;
  }
  // Count every match, but retain only the requested page.
  return { servers: page, total };
}
