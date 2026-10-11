import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
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
  if (!actor || !can(actor, "admin.moderation"))
    return (
      <div className="nexus-panel mx-auto max-w-md space-y-3 p-6">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p role="alert" className="text-sm text-danger">
          {authError ? copy.unavailable : copy.denied}
        </p>
        {!actor && !authError ? (
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.signIn}
          </Link>
        ) : authError ? (
          <a
            href={id ? moderationDetailHref(id) : "/admin/community"}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.reload}
          </a>
        ) : null}
      </div>
    );
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
    <div className="nexus-panel space-y-3 p-5">
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
      <a className="inline-flex min-h-11 items-center text-sm text-accent underline" href={href}>
        {copy.reload}
      </a>
    </div>
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
        <div className="space-y-5">
          <Link
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
            href="/admin/community"
          >
            {copy.back}
          </Link>
          <h1 className="text-2xl font-bold text-primary">{copy.detail}</h1>
          {failure(error || copy.unavailable, moderationDetailHref(id))}
        </div>
      );
    const { item, history, nextCursor } = parsed.data;
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href="/admin/community"
        >
          {copy.back}
        </Link>
        <header className="nexus-panel space-y-3 p-5">
          <h1 className="break-words text-2xl font-bold text-primary">{item.title}</h1>
          <p className="text-sm text-muted">
            {types[item.type]} · {copy[item.status]}
          </p>
          <Link
            className="text-sm text-accent underline"
            href={`/users/${encodeURIComponent(item.author.username)}`}
          >
            {item.author.name} (@{item.author.username})
          </Link>
          <p className="text-xs text-muted">
            {copy.updated}: {date(item.updatedAt)}
          </p>
          {item.status === "published" && (
            <Link
              href={`/articles/${encodeURIComponent(item.slug)}`}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.publicPage}
            </Link>
          )}
          {[item.organization, item.server].map(
            (context) =>
              context && (
                <Link
                  key={context.href}
                  href={context.href}
                  className="block break-words text-sm text-accent underline"
                >
                  {context.name}
                </Link>
              ),
          )}
          {item.tags.length > 0 && (
            <p className="break-words text-xs text-muted">{item.tags.join(" · ")}</p>
          )}
        </header>
        <section className="nexus-panel space-y-3 p-5">
          <h2 className="font-heading text-primary">{copy.body}</h2>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
            {item.body}
          </div>
          {item.truncated && (
            <p role="alert" className="text-sm text-danger">
              {copy.large}
            </p>
          )}
        </section>
        <section className="nexus-panel space-y-4 p-5">
          <p className="text-sm text-muted">{copy.description}</p>
          <Link
            href={`/admin/community/${encodeURIComponent(id)}/discussion`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
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
        <section className="space-y-4">
          <h2 className="font-heading text-primary">{copy.history}</h2>
          <p className="text-sm text-muted">{copy.historyScope}</p>
          <a
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
            href={moderationDetailHref(id)}
          >
            {copy.latest}
          </a>
          {!history.length && (
            <p className="nexus-panel p-5 text-sm text-muted">{copy.noHistory}</p>
          )}
          <ol className="space-y-3">
            {history.map((event) => (
              <li key={event.id} className="nexus-panel space-y-2 p-5">
                <p className="text-sm text-primary">
                  {event.action === "content.published" ? copy.publish : copy.archive} ·{" "}
                  {date(event.createdAt)}
                </p>
                <p className="text-xs text-muted">
                  {event.from ? copy[event.from] : copy.unknown} →{" "}
                  {event.to ? copy[event.to] : copy.unknown}
                </p>
                {event.notes && (
                  <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                    {copy.reason}: {event.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {nextCursor && (
            <Link
              prefetch={false}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
              href={moderationDetailHref(id, nextCursor)}
            >
              {copy.older}
            </Link>
          )}
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
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <Link
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href="/admin/reports"
        >
          {locale === "ru" ? "Жалобы сообщества" : "Community reports"}
        </Link>
      </header>
      {parsed.success && filters && (
        <>
          <form
            method="get"
            action="/admin/community"
            className="nexus-panel flex flex-wrap items-end gap-3 p-4"
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
            <button
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
              type="submit"
            >
              {copy.apply}
            </button>
            <Link
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
              href="/admin/community"
            >
              {copy.reset}
            </Link>
          </form>
          {!parsed.data.items.length ? (
            <p className="nexus-panel p-5 text-sm text-muted">{copy.empty}</p>
          ) : (
            <ul className="space-y-3">
              {parsed.data.items.map((item) => (
                <li key={item.id} className="nexus-panel space-y-2 p-5">
                  <Link
                    className="block break-words font-semibold text-accent underline"
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
            <a
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
              href={moderationHref(filters)}
            >
              {copy.latest}
            </a>
            {parsed.data.nextCursor && (
              <Link
                prefetch={false}
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
                href={moderationHref(filters, parsed.data.nextCursor)}
              >
                {copy.older}
              </Link>
            )}
          </nav>
        </>
      )}
      {error && failure(error, filters ? moderationHref(filters) : "/admin/community")}
    </div>
  );
}
