import { followWorkspaceRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { Avatar, Button, EmptyState } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { DISCOVER_CONTENT_TYPES, type DiscoverQuery, discoverHref } from "../lib/discover-query";
import { discoveryCopy } from "../lib/discovery-copy";
import { type DiscoveryStreamQuery, discoveryStreamHref } from "../lib/discovery-stream-contract";
import { discoveryStreamCopy, discoveryStreamError } from "../lib/discovery-stream-copy";
import { getDictionary, type Locale } from "../lib/i18n";
import { authService } from "../lib/services/auth-service";
import { discoveryService } from "../lib/services/discovery-service";
import {
  indexMtaObservations,
  mtaMasterDirectoryService,
} from "../lib/services/mta-master-directory-service";
import { ArticleCard } from "./article-card";
import { FollowButton } from "./follow-button";
import { ProductCard } from "./product-card";
import { ServerCard } from "./server-card";

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
    if (stream)
      loadError = discoveryStreamError(
        locale,
        failure instanceof AppError ? failure.code : "INTERNAL_ERROR",
      );
    return null;
  });
  if (!result)
    return (
      <div role="alert" className="nexus-panel space-y-3 p-5 text-danger">
        <p>{loadError}</p>
        <Link
          className="text-accent underline"
          href={stream ? discoveryStreamHref(stream) : discoverHref(state, path)}
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
  const observationFor = indexMtaObservations(directory?.servers ?? []);
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
          <Link href="/servers" className="text-accent underline">
            {copy.master}
          </Link>
        </p>
      )}
      {!result.items.length ? (
        <EmptyState title={copy.empty} description={copy.emptyHint} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.type === "resources" &&
            result.items.map((product) => (
              <div key={product.id} className="flex flex-col gap-2">
                <ProductCard product={product} locale={locale} />
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
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {discoveryStreamCopy(locale).latest}
          </a>
          {"previousCursor" in result && typeof result.previousCursor === "string" && (
            <Link
              prefetch={false}
              href={discoveryStreamHref(stream, result.previousCursor)}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {discoveryStreamCopy(locale).newer}
            </Link>
          )}
          {typeof result.nextCursor === "string" && (
            <Link
              prefetch={false}
              href={discoveryStreamHref(stream, result.nextCursor)}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
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
                className="min-h-11 content-center text-sm text-accent"
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
                className="min-h-11 content-center text-sm text-accent"
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
