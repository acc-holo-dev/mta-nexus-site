"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Search, Users } from "lucide-react";
import type { MtaMasterServer } from "../lib/services/mta-master-directory-service";
import { getDictionary, type Locale } from "../lib/i18n";

const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12_000;
const SEARCH_DELAY_MS = 250;
const controlClass =
  "rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

type DirectoryResponse = {
  servers: MtaMasterServer[];
  total: number;
  offset: number;
  limit: number;
  fetchedAt: string;
  isStale: boolean;
};

function ServerCard({
  server,
  locale,
}: {
  server: MtaMasterServer;
  locale: Locale;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.servers;
  const address = `${server.address}:${server.port}`;
  const name = server.name?.trim() || address;
  const addressInput = useRef<HTMLInputElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copying, setCopying] = useState(false);

  async function copyAddress() {
    setCopying(true);
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(address);
      setCopyMessage(`${copy.copied}: ${address}`);
    } catch {
      addressInput.current?.focus();
      addressInput.current?.select();
      setCopyMessage(copy.copyUnavailable);
    } finally {
      setCopying(false);
    }
  }

  return (
    <article
      aria-label={name}
      className="nexus-panel min-w-0 space-y-3 p-4"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-primary [overflow-wrap:anywhere]">
            {name}
          </h3>
          <p className="text-xs text-secondary [overflow-wrap:anywhere]">
            {[server.gameMode, server.mapName, server.version]
              .filter(Boolean)
              .join(" / ") || copy.noDetails}
          </p>
          {server.passworded && (
            <p className="mt-1 text-xs text-secondary">
              {copy.passwordRequired}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-sm text-secondary">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>
            {server.players === undefined
              ? copy.playersUnknown
              : `${server.players} ${copy.players}`}
            {server.maxPlayers !== undefined &&
              ` / ${server.maxPlayers} ${copy.slots}`}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-secondary">
          {copy.serverAddress}
          <input
            ref={addressInput}
            aria-label={`${copy.serverAddress}: ${name}`}
            readOnly
            value={address}
            onFocus={(event) => event.currentTarget.select()}
            className={`${controlClass} mt-1 w-full font-mono`}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <a
            href={`mtasa://${server.address}:${server.port}`}
            aria-label={`${copy.connect}: ${name}`}
            className={`${controlClass} inline-flex items-center bg-accent-soft font-semibold text-accent`}
          >
            {copy.connect}
          </a>
          <button
            type="button"
            aria-label={`${copy.copyAddress}: ${name}`}
            disabled={copying}
            onClick={copyAddress}
            className={`${controlClass} inline-flex items-center gap-1.5 disabled:opacity-50`}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copying ? copy.copying : copy.copyAddress}
          </button>
        </div>
      </div>
      <p
        role="status"
        className="text-xs text-secondary [overflow-wrap:anywhere]"
      >
        {copyMessage}
      </p>
    </article>
  );
}

export function MtaMasterServerDirectory({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.servers;
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
          const lastPage = Math.max(
            0,
            Math.ceil(result.total / PAGE_SIZE) - 1,
          );
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setDirectory(result);
        })
        .catch(() => {
          if (!active) return;
          setError(
            timedOut
              ? locale === "ru"
                ? "Каталог MTA слишком долго не отвечал. Попробуйте ещё раз."
                : "The MTA directory took too long to respond. Please try again."
              : locale === "ru"
                ? "Каталог MTA временно недоступен. Попробуйте ещё раз."
                : "The MTA directory is temporarily unavailable. Please try again.",
          );
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
  }, [minimumPlayers, page, query, attempt, locale]);

  const totalPages = Math.max(
    1,
    Math.ceil((directory?.total ?? 0) / PAGE_SIZE),
  );
  const hasFilters = Boolean(query.trim()) || minimumPlayers > 0;
  const fetchedDate = directory ? new Date(directory.fetchedAt) : null;
  const validDate = fetchedDate && !Number.isNaN(fetchedDate.getTime());
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

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
    <section
      aria-label={copy.directory}
      className="min-w-0 space-y-4"
    >
      <div className="nexus-panel space-y-3 p-4">
        <div>
          <h2 className="text-lg font-bold text-primary">{copy.network}</h2>
          <p role="status" className="mt-1 text-xs text-secondary">
            {loading ? (
              copy.loading
            ) : directory ? (
              <>
                {directory.total.toLocaleString(dateLocale)}{" "}
                {locale === "ru" ? "публичных серверов." : "public servers."}{" "}
                {validDate ? (
                  <>
                    {copy.updated}{" "}
                    <time dateTime={directory.fetchedAt}>
                      {fetchedDate.toLocaleString(dateLocale)}
                    </time>
                    .
                  </>
                ) : (
                  copy.updateUnknown
                )}
              </>
            ) : (
              copy.unavailable
            )}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs text-secondary">
            {copy.search}
            <div className="relative mt-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                maxLength={100}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className={`${controlClass} w-full pl-9`}
              />
            </div>
          </label>

          <label className="text-xs text-secondary">
            {copy.minimumPlayers}
            <select
              value={minimumPlayers}
              onChange={(event) =>
                updateMinimumPlayers(Number(event.target.value))
              }
              className={`${controlClass} mt-1 block w-full`}
            >
              <option value={0}>{copy.anyPlayers}</option>
              <option value={1}>1+ {copy.players}</option>
              <option value={10}>10+ {copy.players}</option>
              <option value={50}>50+ {copy.players}</option>
              <option value={100}>100+ {copy.players}</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-secondary">{copy.connectHint}</p>
      </div>

      {directory?.isStale && !loading && (
        <p
          role="status"
          className="nexus-panel bg-warning-soft p-4 text-sm text-secondary"
        >
          {copy.stale}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="nexus-panel space-y-3 p-6 text-sm text-secondary"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
            className={controlClass}
          >
            {copy.tryAgain}
          </button>
        </div>
      )}

      {!error && !loading && directory && (
        <div className="space-y-2">
          {directory.servers.map((server) => (
            <ServerCard
              key={`${server.address}:${server.port}`}
              server={server}
              locale={locale}
            />
          ))}
          {directory.servers.length === 0 && (
            <div className="nexus-panel space-y-3 p-6 text-center text-sm text-secondary">
              <p>{hasFilters ? copy.noMatch : copy.none}</p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className={controlClass}
                >
                  {copy.resetFilters}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAttempt((current) => current + 1)}
                  className={controlClass}
                >
                  {copy.tryAgain}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!error &&
        !loading &&
        directory &&
        directory.total > PAGE_SIZE && (
          <nav
            className="flex flex-wrap items-center justify-between gap-3"
            aria-label={copy.directory}
          >
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.max(0, current - 1))
              }
              disabled={page === 0}
              className={`${controlClass} inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {copy.previous}
            </button>
            <span className="text-xs text-secondary">
              {copy.page} {page + 1} {copy.of} {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages - 1, current + 1),
                )
              }
              disabled={page >= totalPages - 1}
              className={`${controlClass} inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {copy.next}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        )}
    </section>
  );
}
