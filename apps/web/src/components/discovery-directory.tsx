import { followWorkspaceRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { Avatar, Button, EmptyState } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { cache } from "react";
import { DISCOVER_CONTENT_TYPES, type DiscoverQuery, discoverHref } from "../lib/discover-query";
import { discoveryCopy } from "../lib/discovery-copy";
import { type DiscoveryStreamQuery, discoveryStreamHref } from "../lib/discovery-stream-contract";
import { discoveryStreamCopy, discoveryStreamError } from "../lib/discovery-stream-copy";
import { getDictionary, type Locale } from "../lib/i18n";
import type { PublicResourceAttribution } from "../lib/public-resource-attribution";
import { authService } from "../lib/services/auth-service";
import { discoveryService } from "../lib/services/discovery-service";
import {
  indexMtaObservations,
  type MtaMasterServer,
  mtaMasterDirectoryService,
} from "../lib/services/mta-master-directory-service";
import { productService } from "../lib/services/product-service";
import { ArticleCard } from "./article-card";
import { FollowButton } from "./follow-button";
import { ProductCard } from "./product-card";
import { ServerCard } from "./server-card";

const observationLookupForSnapshot = cache((servers: readonly MtaMasterServer[]) =>
  indexMtaObservations(servers),
);

export function DirectoryFilters({
  state,
  locale,
  path = "/discover",
  stream = false,
}: {
  state: DiscoverQuery;
  locale: Locale;
  path?: string;
  stream?: boolean;
}) {
  const copy = discoveryCopy(locale);
  const dictionary = getDictionary(locale).discover;
  const field =
    "min-h-11 w-full rounded-lg border border-base bg-surface px-3 text-sm text-primary focus-visible:outline-2 focus-visible:outline-accent";
  const names =
    state.type === "servers" || state.type === "creators" || state.type === "organizations";
  return (
    <search aria-label={copy.filter}>
      <form
        key={discoverHref(state, path)}
        action={path}
        method="get"
        className="nexus-panel space-y-4 p-4"
      >
        {(path === "/discover" || stream) && <input type="hidden" name="type" value={state.type} />}
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 space-y-1 text-xs text-secondary">
            {dictionary.searchLabel}
            <input
              className={field}
              name="q"
              type="search"
              maxLength={100}
              defaultValue={state.query}
              placeholder={dictionary.searchPlaceholder}
            />
          </label>
          {names && !stream && (
            <label className="space-y-1 text-xs text-secondary">
              {copy.sort}
              <select name="sort" defaultValue={state.sort} className={field}>
                <option value="newest">{copy.newest}</option>
                <option value="name">{copy.name}</option>
              </select>
            </label>
          )}
          {state.type === "content" && (
            <label className="space-y-1 text-xs text-secondary">
              {copy.contentType}
              <select name="contentType" defaultValue={state.contentType} className={field}>
                <option value="">{copy.any}</option>
                {DISCOVER_CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {copy[type]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" className="min-h-11 font-semibold">
            {dictionary.searchButton}
          </Button>
          {state.query ? (
            <Link
              href={
                stream
                  ? discoveryStreamHref({
                      type: state.type as "servers" | "creators" | "organizations",
                      query: "",
                      verified: state.verified,
                      language: state.language,
                      region: state.region,
                      gameMode: state.gameMode,
                    })
                  : discoverHref({ ...state, query: "", page: 1 }, path)
              }
              className="min-h-11 content-center text-sm text-accent underline"
            >
              {copy.clearQuery}
            </Link>
          ) : null}
          <Link
            href={stream ? `${path}?type=${state.type}` : discoverHref({ type: state.type }, path)}
            className="min-h-11 content-center text-sm text-accent underline"
          >
            {copy.reset}
          </Link>
        </div>
        {state.type === "servers" && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(["language", "region", "gameMode"] as const).map((key) => (
              <label key={key} className="space-y-1 text-xs text-secondary">
                {copy[key]}
                <input name={key} defaultValue={state[key]} maxLength={60} className={field} />
              </label>
            ))}
          </div>
        )}
        {names && (
          <label className="flex min-h-8 items-center gap-2 text-sm text-secondary">
            <input type="checkbox" name="verified" value="1" defaultChecked={state.verified} />
            {copy.verified}
          </label>
        )}
      </form>
    </search>
  );
}

export async function DirectoryResults({
  state,
  locale,
  path = "/discover",
  stream,
}: {
  state: DiscoverQuery;
  locale: Locale;
  path?: string;
  stream?: DiscoveryStreamQuery;
}) {
  const copy = discoveryCopy(locale);
  const dictionary = getDictionary(locale).discover;
  let loadError = copy.unavailable;
  const result = await (stream
    ? discoveryService.stream(stream)
    : discoveryService.page(state)
  ).catch((failure: unknown) => {
    const code = failure instanceof AppError ? failure.code : "INTERNAL_ERROR";
    loadError = stream
      ? discoveryStreamError(locale, code)
      : code === "RATE_LIMIT_EXCEEDED"
        ? copy.rate
        : code === "INVALID_CURSOR" || code === "VALIDATION_ERROR"
          ? copy.invalid
          : copy.unavailable;
    return null;
  });
  if (!result)
    return (
      <div role="alert" className="nexus-panel space-y-3 p-5 text-danger">
        <p>{loadError}</p>
        <Link
          className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          href={stream ? discoveryStreamHref(stream) : discoverHref({ ...state, page: 1 }, path)}
        >
          {dictionary.searchButton}
        </Link>
      </div>
    );
  const targetType =
    result.type === "creators"
      ? "user"
      : result.type === "organizations"
        ? "organization"
        : result.type === "servers"
          ? "server"
          : "product";
  const resourceAttributions: Map<string, PublicResourceAttribution> =
    result.type === "resources"
      ? await productService.getPublicAttributions(result.items)
      : new Map();
  const readFollows = async () => {
    const viewer =
      result.items.length && result.type !== "content"
        ? await authService
            .getSession((await cookies()).get("nexus_session")?.value)
            .then((user) => ({ user, failed: false }))
            .catch(() => ({ user: null, failed: true }))
        : { user: null, failed: false };
    const actor = viewer.user;
    // One bounded read for the whole grid; cards never issue per-item state reads.
    const followed = viewer.failed
      ? null
      : actor
        ? await followWorkspaceRepository
            .states(
              actor.id,
              targetType,
              result.items.map((item) => item.id),
            )
            .catch(() => null)
        : [];
    return { actor, saved: followed ? new Set(followed) : null };
  };
  const [directory, { actor, saved }] = await Promise.all([
    result.type === "servers" && result.items.length
      ? mtaMasterDirectoryService.getDirectory().catch(() => null)
      : null,
    readFollows(),
  ]);
  const observationFor = observationLookupForSnapshot(directory?.servers ?? []);
  const followControl = (id: string, name: string) => (
    <FollowButton
      targetType={targetType}
      targetId={id}
      targetName={name}
      initial={{
        authenticated: !!actor,
        following: saved?.has(id) ?? false,
        self: targetType === "user" && actor?.id === id,
        error: saved === null,
      }}
    />
  );
  return (
    <div className="space-y-5">
      {state.type === "servers" && (
        <p className="text-sm text-muted">
          {copy.serversHint}{" "}
          <Link
            href="/servers"
            className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copy.master}
          </Link>
        </p>
      )}
      {!result.items.length ? (
        <div className="space-y-3">
          <EmptyState
            title={copy.empty}
            description={hasActiveDiscoverFilters(state) ? copy.emptyFiltered : copy.emptyHint}
          />
          {hasActiveDiscoverFilters(state) && (
            <div className="nexus-panel space-y-2 p-4 text-sm text-secondary">
              <p className="font-semibold text-primary">{copy.activeFilters}</p>
              <ul className="list-inside list-disc space-y-1">
                {state.query ? <li>q: {state.query}</li> : null}
                {state.verified ? <li>{copy.verified}</li> : null}
                {state.sort === "name" ? <li>{copy.name}</li> : null}
                {state.language ? (
                  <li>
                    {copy.language}: {state.language}
                  </li>
                ) : null}
                {state.region ? (
                  <li>
                    {copy.region}: {state.region}
                  </li>
                ) : null}
                {state.gameMode ? (
                  <li>
                    {copy.gameMode}: {state.gameMode}
                  </li>
                ) : null}
                {state.contentType ? (
                  <li>
                    {copy.contentType}: {copy[state.contentType]}
                  </li>
                ) : null}
                {state.page > 1 ? (
                  <li>
                    {copy.page} {state.page}
                  </li>
                ) : null}
              </ul>
              <div className="flex flex-wrap gap-3 pt-1">
                {state.query ? (
                  <Link
                    className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    href={discoverHref({ ...state, query: "", page: 1 }, path)}
                  >
                    {copy.clearQuery}
                  </Link>
                ) : null}
                <Link
                  className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  href={discoverHref({ type: state.type }, path)}
                >
                  {copy.reset}
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.type === "resources" &&
            result.items.map((product) => (
              <div key={product.id} className="flex flex-col gap-2">
                <ProductCard
                  product={product}
                  locale={locale}
                  attribution={resourceAttributions.get(product.id) ?? null}
                />
                {followControl(product.id, product.title)}
              </div>
            ))}
          {result.type === "content" &&
            result.items.map((article) => (
              <ArticleCard key={article.id} article={article} locale={locale} />
            ))}
          {result.type === "servers" &&
            result.items.map((server) => (
              <div key={server.id} className="flex flex-col gap-2">
                <ServerCard
                  server={server}
                  locale={locale}
                  observation={observationFor(server)}
                  isStale={directory?.isStale}
                />
                {followControl(server.id, server.name)}
              </div>
            ))}
          {result.type === "creators" &&
            result.items.map((item) => (
              <div key={item.id} className="space-y-2">
                <DirectoryIdentity
                  title={item.displayName}
                  subtitle={`@${item.username}`}
                  description={item.bio || dictionary.creatorFallback}
                  avatar={item.avatarUrl}
                  verified={item.isVerified}
                  href={`/developers/${encodeURIComponent(item.username)}`}
                  locale={locale}
                />
                {followControl(item.id, item.displayName)}
              </div>
            ))}
          {result.type === "organizations" &&
            result.items.map((item) => (
              <div key={item.id} className="space-y-2">
                <DirectoryIdentity
                  title={item.name}
                  subtitle={`@${item.slug}`}
                  description={item.description || dictionary.organizationFallback}
                  avatar={item.logoUrl}
                  verified={item.isVerified}
                  href={`/organizations/${encodeURIComponent(item.slug)}`}
                  locale={locale}
                />
                {followControl(item.id, item.name)}
              </div>
            ))}
        </div>
      )}
      {stream && "nextCursor" in result ? (
        <nav aria-label={copy.pages} className="flex flex-wrap gap-4 border-t border-base pt-4">
          <a
            href={discoveryStreamHref(stream)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {discoveryStreamCopy(locale).latest}
          </a>
          {"previousCursor" in result && typeof result.previousCursor === "string" && (
            <Link
              prefetch={false}
              href={discoveryStreamHref(stream, result.previousCursor)}
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {discoveryStreamCopy(locale).newer}
            </Link>
          )}
          {typeof result.nextCursor === "string" && (
            <Link
              prefetch={false}
              href={discoveryStreamHref(stream, result.nextCursor)}
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {discoveryStreamCopy(locale).older}
            </Link>
          )}
        </nav>
      ) : (
        (result.page > 1 || result.hasMore) && (
          <nav
            aria-label={copy.pages}
            className="flex items-center justify-between gap-3 border-t border-base pt-4"
          >
            {result.page > 1 ? (
              <Link
                className="min-h-11 content-center text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                href={discoverHref({ ...state, page: result.page - 1 }, path)}
              >
                {copy.previous}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted">
              {copy.page} {result.page}
            </span>
            {result.hasMore ? (
              <Link
                className="min-h-11 content-center text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                href={discoverHref({ ...state, page: result.page + 1 }, path)}
              >
                {copy.next}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )
      )}
    </div>
  );
}
function hasActiveDiscoverFilters(state: DiscoverQuery) {
  return Boolean(
    state.query ||
      state.verified ||
      state.sort === "name" ||
      state.language ||
      state.region ||
      state.gameMode ||
      state.contentType ||
      state.page > 1,
  );
}
function DirectoryIdentity({
  title,
  subtitle,
  description,
  avatar,
  verified,
  href,
  locale,
}: {
  title: string;
  subtitle: string;
  description: string;
  avatar: string | null;
  verified: boolean;
  href: string;
  locale: Locale;
}) {
  return (
    <Link
      href={href}
      className="nexus-panel flex gap-4 p-5 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Avatar src={avatar ?? undefined} alt={title} fallback={title} size="lg" />
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
          <span className="truncate">{title}</span>
          {verified && (
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-success"
              aria-label={getDictionary(locale).discover.verified}
            />
          )}
        </h2>
        <p className="truncate text-xs text-faint">{subtitle}</p>
        <p className="mt-2 line-clamp-3 text-sm text-muted">{description}</p>
      </div>
    </Link>
  );
}
