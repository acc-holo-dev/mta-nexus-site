"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Search, Users } from "lucide-react";
import type { MtaMasterServer } from "../lib/services/mta-master-directory-service";

const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12_000;
const SEARCH_DELAY_MS = 250;
const controlClass = "rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

type DirectoryResponse = {
  servers: MtaMasterServer[];
  total: number;
  offset: number;
  limit: number;
  fetchedAt: string;
  isStale: boolean;
};

function ServerCard({ server }: { server: MtaMasterServer }) {
  const address = `${server.address}:${server.port}`;
  const name = server.name?.trim() || address;
  const addressInput = useRef<HTMLInputElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copying, setCopying] = useState(false);

  async function copyAddress() {
    setCopying(true);
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(address);
      setCopyMessage(`Address copied: ${address}`);
    } catch {
      // Always leave a usable manual path, including browsers denying clipboard access.
      addressInput.current?.focus();
      addressInput.current?.select();
      setCopyMessage("Copy is unavailable. The address is selected; copy it manually.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <article aria-label={name} className="nexus-panel min-w-0 p-4 space-y-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-primary [overflow-wrap:anywhere]">{name}</h3>
          <p className="text-xs text-secondary [overflow-wrap:anywhere]">
            {[server.gameMode, server.mapName, server.version].filter(Boolean).join(" / ") || "No additional server details"}
          </p>
          {server.passworded && <p className="text-xs text-secondary mt-1">Password required</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-sm text-secondary">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{server.players === undefined ? "Player count unknown" : `${server.players} players`}
            {server.maxPlayers !== undefined && ` / ${server.maxPlayers} slots`}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-secondary">
          Server address
          <input ref={addressInput} aria-label={`Server address for ${name}`} readOnly value={address}
            onFocus={(event) => event.currentTarget.select()}
            className={`${controlClass} mt-1 w-full font-mono`} />
        </label>
        <div className="flex flex-wrap gap-2">
          <a href={"mtasa://" + server.address + ":" + server.port} aria-label={`Connect to ${name}`}
            className={`${controlClass} inline-flex items-center bg-accent-soft text-accent font-semibold`}>Connect</a>
          <button type="button" aria-label={`Copy address for ${name}`} disabled={copying} onClick={copyAddress}
            className={`${controlClass} inline-flex items-center gap-1.5 disabled:opacity-50`}>
            <Copy className="h-4 w-4" aria-hidden="true" /> {copying ? "Copying..." : "Copy address"}
          </button>
        </div>
      </div>
      <p role="status" className="text-xs text-secondary [overflow-wrap:anywhere]">{copyMessage}</p>
    </article>
  );
}

export function MtaMasterServerDirectory() {
  const [query, setQuery] = useState("");
  const [minimumPlayers, setMinimumPlayers] = useState(0);
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const params = new URLSearchParams({
      minPlayers: String(minimumPlayers),
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (query.trim()) params.set("query", query.trim());

    setLoading(true);
    setError(null);
    setDirectory(null);
    const scheduled = window.setTimeout(() => {
      fetch("/api/servers/directory?" + params, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Directory request failed");
          return (await response.json()) as DirectoryResponse;
        })
        .then((result) => {
          if (!active) return;
          // The live list can shrink between page requests; recover to a valid page.
          const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1);
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setDirectory(result);
        })
        .catch(() => {
          // Cleanup aborts belong to an obsolete query, not an error for the new one.
          if (!active) return;
          setError(timedOut
            ? "The MTA directory took too long to respond. Please try again."
            : "The MTA directory is temporarily unavailable. Please try again.");
        })
        .finally(() => {
          window.clearTimeout(timeout);
          if (active) setLoading(false);
        });
    }, SEARCH_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(scheduled);
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [minimumPlayers, page, query, attempt]);

  const totalPages = Math.max(1, Math.ceil((directory?.total ?? 0) / PAGE_SIZE));
  const hasFilters = Boolean(query.trim()) || minimumPlayers > 0;
  const fetchedDate = directory ? new Date(directory.fetchedAt) : null;
  const validDate = fetchedDate && !Number.isNaN(fetchedDate.getTime());

  function updateQuery(value: string) {
    setQuery(value);
    setPage(0);
  }

  function updateMinimumPlayers(value: number) {
    setMinimumPlayers(value);
    setPage(0);
  }

  function resetFilters() {
    setQuery("");
    setMinimumPlayers(0);
    setPage(0);
  }

  return (
    <section aria-label="Server directory" className="min-w-0 space-y-4">
      <div className="nexus-panel p-4 space-y-3">
        <div>
          <h2 className="text-lg font-bold text-primary">MTA Network</h2>
          <p role="status" className="text-xs text-secondary mt-1">
            {loading ? "Loading servers..." : directory
              ? <>{directory.total.toLocaleString()} public servers. {validDate
                ? <>Updated <time dateTime={directory.fetchedAt}>{fetchedDate.toLocaleString()}</time>.</>
                : "Update time unknown."}</>
              : "Server list unavailable."}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs text-secondary">
            Search servers
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input type="search" value={query} maxLength={100} onChange={(event) => updateQuery(event.target.value)}
                placeholder="Name, IP, mode or map" className={`${controlClass} w-full pl-9`} />
            </div>
          </label>
          <label className="text-xs text-secondary">
            Minimum players
            <select value={minimumPlayers} onChange={(event) => updateMinimumPlayers(Number(event.target.value))}
              className={`${controlClass} mt-1 block w-full`}>
              <option value={0}>Any player count</option>
              <option value={1}>1+ players</option>
              <option value={10}>10+ players</option>
              <option value={50}>50+ players</option>
              <option value={100}>100+ players</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-secondary">Connect opens your installed MTA client. You can also copy the server address.</p>
      </div>

      {directory?.isStale && !loading && <p role="status" className="nexus-panel bg-warning-soft p-4 text-sm text-secondary">
        Updates are delayed. Showing the last available snapshot; player counts may have changed.
      </p>}

      {error && <div role="alert" className="nexus-panel p-6 space-y-3 text-sm text-secondary">
        <p>{error}</p>
        <button type="button" onClick={() => setAttempt((current) => current + 1)} className={controlClass}>Try again</button>
      </div>}

      {!error && !loading && directory && <div className="space-y-2">
        {directory.servers.map((server) => <ServerCard key={server.address + ":" + server.port} server={server} />)}
        {directory.servers.length === 0 && <div className="nexus-panel p-6 text-center text-sm text-secondary space-y-3">
          <p>{hasFilters ? "No public MTA servers match these filters." : "No public MTA servers are available right now."}</p>
          {hasFilters
            ? <button type="button" onClick={resetFilters} className={controlClass}>Reset filters</button>
            : <button type="button" onClick={() => setAttempt((current) => current + 1)} className={controlClass}>Try again</button>}
        </div>}
      </div>}

      {!error && !loading && directory && directory.total > PAGE_SIZE && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Server directory pages">
          <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}
            className={`${controlClass} inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </button>
          <span className="text-xs text-secondary">Page {page + 1} of {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1}
            className={`${controlClass} inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50`}>
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}
