"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import type { MtaMasterServer } from "../lib/services/mta-master-directory-service";

const PAGE_SIZE = 50;

type DirectoryResponse = {
  servers: MtaMasterServer[];
  total: number;
  offset: number;
  limit: number;
  fetchedAt: string;
  isStale: boolean;
};

export function MtaMasterServerDirectory() {
  const [query, setQuery] = useState("");
  const [minimumPlayers, setMinimumPlayers] = useState(0);
  const [page, setPage] = useState(0);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    const params = new URLSearchParams({
      minPlayers: String(minimumPlayers),
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (query.trim()) params.set("query", query.trim());

    setLoading(true);
    setError(null);
    fetch("/api/servers/directory?" + params, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The MTA directory is temporarily unavailable");
        return (await response.json()) as DirectoryResponse;
      })
      .then(setDirectory)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          setError("The MTA directory took too long to respond. Try again shortly.");
          return;
        }
        setError("The MTA directory is temporarily unavailable. Try again shortly.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [minimumPlayers, page, query]);

  const totalPages = Math.max(1, Math.ceil((directory?.total ?? 0) / PAGE_SIZE));

  function updateQuery(value: string) {
    setQuery(value);
    setPage(0);
  }

  function updateMinimumPlayers(value: number) {
    setMinimumPlayers(value);
    setPage(0);
  }

  return (
    <section className="space-y-4">
      <div className="nexus-panel p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">MTA Network</h2>
          <p className="text-xs text-neutral-400 mt-1">
            {directory
              ? `${directory.total.toLocaleString()} public servers · updated ${new Date(directory.fetchedAt).toLocaleTimeString()}${directory.isStale ? " · showing the latest available snapshot" : ""}`
              : "Loading the official MTA server directory…"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search name, IP, mode or map" className="w-full rounded-lg border border-base bg-neutral-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500" />
          </label>
          <select value={minimumPlayers} onChange={(event) => updateMinimumPlayers(Number(event.target.value))} className="rounded-lg border border-base bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
            <option value={0}>Any player count</option>
            <option value={1}>1+ players</option>
            <option value={10}>10+ players</option>
            <option value={50}>50+ players</option>
            <option value={100}>100+ players</option>
          </select>
        </div>
      </div>

      {error && <div className="nexus-panel p-6 text-sm text-neutral-400">{error}</div>}

      {!error && <div className="space-y-2">
        {directory?.servers.map((server) => (
          <a key={server.address + ":" + server.port} href={"mtasa://" + server.address + ":" + server.port} className="nexus-panel block p-4 hover:border-emerald-500/70 transition-colors">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{server.name || server.address + ":" + server.port}</p>
                <p className="text-xs text-neutral-400 truncate">{[server.gameMode, server.mapName, server.version].filter(Boolean).join(" · ") || server.address + ":" + server.port}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-emerald-400"><Users className="w-4 h-4" /><span>{server.players ?? 0}/{server.maxPlayers ?? "?"}</span></div>
            </div>
          </a>
        ))}
        {!loading && directory?.servers.length === 0 && <div className="nexus-panel p-8 text-center text-sm text-neutral-400">No public MTA servers match these filters.</div>}
      </div>}

      {directory && directory.total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-3" aria-label="Server directory pages">
          <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading} className="inline-flex items-center gap-1 rounded-lg border border-base px-3 py-2 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs text-neutral-400">Page {page + 1} of {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1 || loading} className="inline-flex items-center gap-1 rounded-lg border border-base px-3 py-2 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </section>
  );
}
