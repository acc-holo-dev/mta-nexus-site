"use client";

import { Button, EmptyState, ErrorState, SearchField } from "@nexus/ui";
import { ChevronLeft, ChevronRight, Copy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { parseDirectoryListQuery, replaceDirectoryListUrl } from "../directory-list-query";
import { panelSpace3P4 } from "../../shell/panel-shell";
import {
  typeFlexWrapCenterBetweenGap3,
  typeFlexWrapGap2,
  typeLgBoldPrimary,
  typeMinFlex1,
  typeMinSpace4,
  typeMt1XsSecondary,
  typeXsSecondary,
  typeXsSecondaryAnywhere,
} from "../../shell/type-shell";
import { mtaEndpointKey } from "../model/mta-listing-profile-map";
import type { MtaMasterServer } from "../model/mta-master-directory-shared";

const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12_000;
const SEARCH_DELAY_MS = 250;
const controlClass =
  "rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";
const connectActionClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-success-solid px-6 py-3 text-sm font-bold text-white shadow-nexus transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";

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
  profileSlug,
}: {
  server: MtaMasterServer;
  locale: Locale;
  profileSlug?: string;
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
    <article aria-label={name} className="nexus-panel min-w-0 space-y-3 p-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-primary [overflow-wrap:anywhere]">{name}</h3>
          <p className={typeXsSecondaryAnywhere}>
            {[server.gameMode, server.mapName, server.version].filter(Boolean).join(" / ") ||
              copy.noDetails}
          </p>
          {server.passworded && <p className={typeMt1XsSecondary}>{copy.passwordRequired}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-sm text-secondary">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>
            {server.players === undefined
              ? copy.playersUnknown
              : `${server.players} ${copy.players}`}
            {server.maxPlayers !== undefined && ` / ${server.maxPlayers} ${copy.slots}`}
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
        <div className={typeFlexWrapGap2}>
          <a
            href={`mtasa://${server.address}:${server.port}`}
            aria-label={`${copy.connect}: ${name}`}
            title={copy.connectHint}
            className={connectActionClass}
          >
            {copy.connect}
          </a>
          {profileSlug ? (
            <Link
              href={`/servers/${encodeURIComponent(profileSlug)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-base px-4 py-3 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.openListing}
            </Link>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="touch"
            aria-label={`${copy.copyAddress}: ${name}`}
            disabled={copying}
            onClick={() => void copyAddress()}
            className="gap-1.5"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copying ? copy.copying : copy.copyAddress}
          </Button>
        </div>
      </div>
      {copyMessage === copy.copyUnavailable ? (
        <ErrorState
          id="mta-master-directory-copy-unavailable"
          title={copy.copyUnavailable}
          description={copy.copyUnavailableHint}
        />
      ) : (
        <p role="status" className={typeXsSecondaryAnywhere}>
          {copyMessage}
        </p>
      )}
    </article>
  );
}

export function PublicDirectoryOutcome({
  locale,
  outcome,
  onRetry,
  resetFilters,
  errorTitle,
}: {
  locale: Locale;
  outcome: "unavailable" | "empty" | "filtered";
  onRetry: () => void;
  resetFilters: () => void;
  errorTitle?: string;
}) {
  const copy = getDictionary(locale).servers;
  if (outcome === "unavailable") {
    return (
      <ErrorState
        id="mta-master-directory-fetch-error"
        title={errorTitle ?? copy.directoryFetchError}
        description={copy.unavailableHint}
        action={
          <Button type="button" variant="secondary" size="touch" onClick={onRetry}>
            {copy.tryAgain}
          </Button>
        }
      />
    );
  }
  const hasFilters = outcome === "filtered";
  return (
    <EmptyState
      title={hasFilters ? copy.noMatch : copy.none}
      description={hasFilters ? copy.noMatchDescription : copy.noneDescription}
      action={
        hasFilters ? (
          <Button type="button" variant="secondary" size="touch" onClick={resetFilters}>
            {copy.resetFilters}
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="touch" onClick={onRetry}>
            {copy.tryAgain}
          </Button>
        )
      }
    />
  );
}

export function MtaMasterServerDirectory({
  locale = "en",
  profileByEndpoint = {},
}: {
  locale?: Locale;
  profileByEndpoint?: Record<string, string>;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.servers;
  const [query, setQuery] = useState("");
  const [minimumPlayers, setMinimumPlayers] = useState(0);
  const [page, setPage] = useState(0);
  const [listReady, setListReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parsed = parseDirectoryListQuery(window.location.search);
    setQuery(parsed.query);
    setMinimumPlayers(parsed.minimumPlayers);
    setPage(parsed.page);
    setListReady(true);
    const onPopState = () => {
      const next = parseDirectoryListQuery(window.location.search);
      setQuery(next.query);
      setMinimumPlayers(next.minimumPlayers);
      setPage(next.page);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    if (!listReady) return;
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
      fetch(`/api/servers/directory?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Directory request failed");
          return (await response.json()) as DirectoryResponse;
        })
        .then((result) => {
          if (!active) return;
          const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1);
          if (page > lastPage) {
            setPage(lastPage);
            replaceDirectoryListUrl({ query, minimumPlayers, page: lastPage });
            return;
          }
          setDirectory(result);
        })
        .catch(() => {
          if (!active) return;
          setError(timedOut ? copy.directoryTimeout : copy.directoryFetchError);
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
  }, [
    listReady,
    minimumPlayers,
    page,
    query,
    attempt,
    copy.directoryFetchError,
    copy.directoryTimeout,
  ]);

  const totalPages = Math.max(1, Math.ceil((directory?.total ?? 0) / PAGE_SIZE));
  const hasFilters = Boolean(query.trim()) || minimumPlayers > 0;
  const fetchedDate = directory ? new Date(directory.fetchedAt) : null;
  const validDate = fetchedDate && !Number.isNaN(fetchedDate.getTime());
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  function updateQuery(value: string) {
    setQuery(value);
    setPage(0);
    replaceDirectoryListUrl({ query: value, minimumPlayers, page: 0 });
  }

  function updateMinimumPlayers(value: number) {
    setMinimumPlayers(value);
    setPage(0);
    replaceDirectoryListUrl({ query, minimumPlayers: value, page: 0 });
  }

  function resetFilters() {
    setQuery("");
    setMinimumPlayers(0);
    setPage(0);
    replaceDirectoryListUrl({ query: "", minimumPlayers: 0, page: 0 });
  }

  function showPage(nextPage: number) {
    setPage(nextPage);
    replaceDirectoryListUrl({ query, minimumPlayers, page: nextPage });
  }

  return (
    <section aria-label={copy.directory} aria-busy={loading} className={typeMinSpace4}>
      <div className={panelSpace3P4}>
        <div>
          <h2 className={typeLgBoldPrimary}>{copy.network}</h2>
          {loading ? (
            <p role="status" aria-live="polite" className={typeMt1XsSecondary}>
              {copy.loading}
            </p>
          ) : directory ? (
            <p role="status" aria-live="polite" className={typeMt1XsSecondary}>
              {directory.total.toLocaleString(dateLocale)} {copy.publicServersLabel}.{" "}
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
            </p>
          ) : error ? null : (
            <ErrorState
              id="mta-master-directory-unavailable"
              title={copy.unavailable}
              description={copy.unavailableHint}
            />
          )}
        </div>

        <search aria-label={copy.search}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className={typeMinFlex1}>
              <SearchField
                label={copy.search}
                value={query}
                maxLength={100}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className={`${controlClass} w-full`}
              />
            </div>

            <label className={typeXsSecondary}>
              {copy.minimumPlayers}
              <select
                value={minimumPlayers}
                onChange={(event) => updateMinimumPlayers(Number(event.target.value))}
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
        </search>
        <p className={typeXsSecondary}>{copy.connectHint}</p>
      </div>

      {directory?.isStale && !loading ? (
        <ErrorState
          id="mta-master-directory-stale"
          title={copy.stale}
          description={copy.staleHint}
        />
      ) : null}

      {error && (
        <PublicDirectoryOutcome
          locale={locale}
          outcome="unavailable"
          errorTitle={error}
          onRetry={() => setAttempt((current) => current + 1)}
          resetFilters={resetFilters}
        />
      )}

      {!error && !loading && directory && (
        <div className="space-y-2">
          {directory.servers.map((server) => (
            <ServerCard
              key={`${server.address}:${server.port}`}
              server={server}
              locale={locale}
              profileSlug={profileByEndpoint[mtaEndpointKey(server.address, server.port)]}
            />
          ))}
          {directory.servers.length === 0 && (
            <PublicDirectoryOutcome
              locale={locale}
              outcome={hasFilters ? "filtered" : "empty"}
              onRetry={() => setAttempt((current) => current + 1)}
              resetFilters={resetFilters}
            />
          )}
        </div>
      )}

      {!error && !loading && directory && directory.total > PAGE_SIZE && (
        <nav className={typeFlexWrapCenterBetweenGap3} aria-label={copy.directory}>
          <Button
            type="button"
            variant="secondary"
            size="touch"
            onClick={() => showPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {copy.previous}
          </Button>
          <span className={typeXsSecondary}>
            {copy.page} {page + 1} {copy.of} {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="touch"
            onClick={() => showPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="gap-1"
          >
            {copy.next}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  );
}
