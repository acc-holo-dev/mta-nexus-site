"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import type { MtaMasterDirectory } from "../lib/services/mta-master-directory-service";

type Props = {
  directory: MtaMasterDirectory;
};

export function MtaMasterServerDirectory({ directory }: Props) {
  const [query, setQuery] = useState("");

  const servers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return directory.servers;

    return directory.servers.filter((server) =>
      [server.name, server.address, server.gameMode, server.mapName, server.version]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(term)
    );
  }, [directory.servers, query]);

  return (
    <section className="space-y-4">
      <div className="nexus-panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">MTA Network</h2>
          <p className="text-xs text-neutral-400 mt-1">
            {directory.servers.length.toLocaleString()} public servers · updated {new Date(directory.fetchedAt).toLocaleTimeString()}
            {directory.isStale ? " · showing the latest available snapshot" : ""}
          </p>
        </div>
        <label className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, IP, mode or map"
            className="w-full rounded-lg border border-base bg-neutral-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="space-y-2">
        {servers.map((server) => (
          <a
            key={`${server.address}:${server.port}`}
            href={`mtasa://${server.address}:${server.port}`}
            className="nexus-panel block p-4 hover:border-emerald-500/70 transition-colors"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{server.name || `${server.address}:${server.port}`}</p>
                <p className="text-xs text-neutral-400 truncate">
                  {[server.gameMode, server.mapName, server.version].filter(Boolean).join(" · ") || `${server.address}:${server.port}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <Users className="w-4 h-4" />
                <span>{server.players ?? 0}/{server.maxPlayers ?? "?"}</span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {servers.length === 0 && (
        <div className="nexus-panel p-8 text-center text-sm text-neutral-400">
          No public MTA servers match this search.
        </div>
      )}
    </section>
  );
}
