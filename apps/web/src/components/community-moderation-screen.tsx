import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { FileText, ShieldAlert } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  moderationDetailHref,
  moderationDetailSchema,
  moderationHref,
  moderationPageSchema,
  parseModerationDetailQuery,
  parseModerationQuery,
} from "../lib/community-moderation-contract";
import { moderationCopy, moderationError } from "../lib/community-moderation-copy";
import { discoveryCopy } from "../lib/discovery-copy";
import { getRequestLocale } from "../lib/i18n-server";
import { moderatedDiscussionCopy } from "../lib/moderated-discussion-copy";
import { PUBLICATION_TYPES } from "../lib/publication-feed-contract";
import { authService } from "../lib/services/auth-service";
import { communityModerationService } from "../lib/services/community-moderation-service";
import { platformFieldClass } from "../lib/user-platform-client";
import { ContentModerationControls } from "./content-moderation-controls";
import { PlatformSignIn } from "./platform-sign-in";

const focusLink =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function CommunityModerationScreen({
  id,
  searchParams,
}: {
  id?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = moderationCopy(locale),
    types = discoveryCopy(locale);
  let authError = false;
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      authError = true;
      return null;
    });
  const returnPath = id ? moderationDetailHref(id) : "/admin/community";
  if (authError) {
    return (
      <div className="mx-auto min-w-0 max-w-md space-y-4 overflow-x-clip py-8">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <ErrorState
          title={copy.unavailable}
          action={
            <a href={returnPath} className={focusLink}>
              {copy.reload}
            </a>
          }
        />
      </div>
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  if (!can(actor, "admin.moderation")) {
    return (
      <div className="mx-auto min-w-0 max-w-md space-y-4 overflow-x-clip py-8">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <ErrorState
          title={copy.denied}
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
        />
      </div>
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const date = (value: string) => (
    <time dateTime={value}>
      {new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
        timeZone: "UTC",
        timeZoneName: "short",
      })}
    </time>
  );
  const failure = (message: string, href: string) => (
    <ErrorState
      title={message}
      action={
        <a className={focusLink} href={href}>
          {copy.reload}
        </a>
      }
    />
  );
  if (id) {
    const filters = parseModerationDetailQuery(params);
    let error = filters ? "" : copy.invalid;
    const raw = filters
      ? await communityModerationService
          .detail(actor, id, filters.cursor)
          .catch((problem: unknown) => {
            if (problem instanceof AppError && problem.code === "NOT_FOUND") notFound();
            error = moderationError(
              locale,
              problem instanceof AppError ? problem.code : "INTERNAL_ERROR",
            );
            return null;
          })
      : null;
    const parsed = moderationDetailSchema.safeParse(raw);
    if (raw && !parsed.success) error = copy.unavailable;
    if (!parsed.success)
      return (
        <div className="min-w-0 space-y-5 overflow-x-clip">
          <Link className={focusLink} href="/admin/community">
            {copy.back}
          </Link>
          <h1 className="text-2xl font-bold text-primary">{copy.detail}</h1>
          {failure(error || copy.unavailable, moderationDetailHref(id))}
        </div>
      );
    const { item, history, nextCursor } = parsed.data;
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip">
        <Link className={focusLink} href="/admin/community">
          {copy.back}
        </Link>
        <header className="nexus-panel min-w-0 space-y-3 p-5">
          <h1 className="break-words text-2xl font-bold text-primary">{item.title}</h1>
          <p className="text-sm text-muted">
            {types[item.type]} · {copy[item.status]}
          </p>
          <Link
            className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            href={`/users/${encodeURIComponent(item.author.username)}`}
          >
            {item.author.name} (@{item.author.username})
          </Link>
          <p className="text-xs text-muted">
            {copy.updated}: {date(item.updatedAt)}
          </p>
          {item.status === "published" && (
            <Link href={`/articles/${encodeURIComponent(item.slug)}`} className={focusLink}>
              {copy.publicPage}
            </Link>
          )}
          {[item.organization, item.server].map(
            (context) =>
              context && (
                <Link
                  key={context.href}
                  href={context.href}
                  className="block break-words text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {context.name}
                </Link>
              ),
          )}
          {item.tags.length > 0 && (
            <p className="break-words text-xs text-muted">{item.tags.join(" · ")}</p>
          )}
        </header>
        <section className="nexus-panel min-w-0 space-y-3 p-5">
          <h2 className="font-heading text-primary">{copy.body}</h2>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
            {item.body}
          </div>
          {item.truncated ? (
            <p role="alert" className="text-sm text-danger">
              {copy.large}
            </p>
          ) : null}
        </section>
        <section className="nexus-panel min-w-0 space-y-4 p-5">
          <p className="text-sm text-muted">{copy.description}</p>
          <Link
            href={`/admin/community/${encodeURIComponent(id)}/discussion`}
            className={focusLink}
          >
            {moderatedDiscussionCopy(locale).open}
          </Link>
          <ContentModerationControls
            key={`${actor.id}:${item.id}:${item.updatedAt}`}
            contentId={item.id}
            expectedUpdatedAt={item.updatedAt}
            status={item.status}
            truncated={item.truncated}
            workspace
          />
        </section>
        <section className="min-w-0 space-y-4">
          <h2 className="font-heading text-primary">{copy.history}</h2>
          <p className="text-sm text-muted">{copy.historyScope}</p>
          <a className={focusLink} href={moderationDetailHref(id)}>
            {copy.latest}
          </a>
          {!history.length ? (
            <EmptyState
              title={copy.noHistory}
              description={copy.historyScope}
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
            />
          ) : null}
          <ol className="min-w-0 space-y-3">
            {history.map((event) => (
              <li key={event.id} className="nexus-panel min-w-0 space-y-2 p-5">
                <p className="text-sm text-primary">
                  {event.action === "content.published" ? copy.publish : copy.archive} ·{" "}
                  {date(event.createdAt)}
                </p>
                <p className="text-xs text-muted">
                  {event.from ? copy[event.from] : copy.unknown} →{" "}
                  {event.to ? copy[event.to] : copy.unknown}
                </p>
                {event.notes ? (
                  <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                    {copy.reason}: {event.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          {nextCursor ? (
            <Link
              prefetch={false}
              className={focusLink}
              href={moderationDetailHref(id, nextCursor)}
            >
              {copy.older}
            </Link>
          ) : null}
        </section>
      </div>
    );
  }
  const filters = parseModerationQuery(params);
  let error = filters ? "" : copy.invalid;
  const raw = filters
    ? await communityModerationService.page(actor, filters).catch((problem: unknown) => {
        error = moderationError(
          locale,
          problem instanceof AppError ? problem.code : "INTERNAL_ERROR",
        );
        return null;
      })
    : null;
  const parsed = moderationPageSchema.safeParse(raw);
  if (raw && !parsed.success) error = copy.unavailable;
  const filtersActive = Boolean(
    filters &&
      (filters.query || filters.author || filters.status || filters.type || filters.cursor),
  );
  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <header className="min-w-0 space-y-2">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <Link className={focusLink} href="/admin/reports">
          {copy.reports}
        </Link>
      </header>
      {parsed.success && filters ? (
        <>
          <form
            method="get"
            action="/admin/community"
            className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
          >
            <label className="min-w-44 flex-1 space-y-1 text-xs text-muted">
              {copy.search}
              <input
                type="search"
                name="q"
                maxLength={100}
                defaultValue={filters.query}
                className={`${platformFieldClass} min-h-11`}
              />
            </label>
            <label className="space-y-1 text-xs text-muted">
              {copy.author}
              <input
                name="author"
                maxLength={128}
                defaultValue={filters.author}
                className={`${platformFieldClass} min-h-11`}
              />
            </label>
            <label className="space-y-1 text-xs text-muted">
              {copy.status}
              <select
                name="status"
                defaultValue={filters.status ?? "all"}
                className={`${platformFieldClass} min-h-11`}
              >
                {(["draft", "published", "archived", "all"] as const).map((status) => (
                  <option key={status} value={status}>
                    {copy[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              {copy.type}
              <select
                name="type"
                defaultValue={filters.type ?? ""}
                className={`${platformFieldClass} min-h-11`}
              >
                <option value="">{copy.all}</option>
                {PUBLICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {types[type]}
                  </option>
                ))}
              </select>
            </label>
            <Button className="min-h-11" type="submit" variant="primary">
              {copy.apply}
            </Button>
            <Link className={focusLink} href="/admin/community">
              {copy.reset}
            </Link>
          </form>
          {!parsed.data.items.length ? (
            <EmptyState
              title={copy.empty}
              description={filtersActive ? copy.reset : copy.description}
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
              action={
                filtersActive ? (
                  <Link className={focusLink} href="/admin/community">
                    {copy.reset}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="min-w-0 space-y-3">
              {parsed.data.items.map((item) => (
                <li key={item.id} className="nexus-panel min-w-0 space-y-2 p-5">
                  <Link
                    className="block break-words font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    href={moderationDetailHref(item.id)}
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {types[item.type]} · {copy[item.status]} · @{item.author.username} ·{" "}
                    {date(item.updatedAt)}
                  </p>
                  <p className="line-clamp-3 break-words text-sm text-secondary">{item.excerpt}</p>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label={copy.title} className="flex flex-wrap gap-4">
            <a className={focusLink} href={moderationHref(filters)}>
              {copy.latest}
            </a>
            {parsed.data.nextCursor ? (
              <Link
                prefetch={false}
                className={focusLink}
                href={moderationHref(filters, parsed.data.nextCursor)}
              >
                {copy.older}
              </Link>
            ) : null}
          </nav>
        </>
      ) : null}
      {error ? failure(error, filters ? moderationHref(filters) : "/admin/community") : null}
    </div>
  );
}
