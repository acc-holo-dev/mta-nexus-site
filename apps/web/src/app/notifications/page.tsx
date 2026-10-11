import { randomUUID } from "node:crypto";
import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { NotificationInbox } from "../../components/notification-inbox";
import { getRequestLocale } from "../../lib/i18n-server";
import {
  INBOX_CATEGORIES,
  notificationInboxHref,
  parseNotificationInboxQuery,
} from "../../lib/notification-inbox-contract";
import { notificationInboxCopy, notificationInboxError } from "../../lib/notification-inbox-copy";
import { authService } from "../../lib/services/auth-service";
import { notificationInboxService } from "../../lib/services/notification-inbox-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = notificationInboxCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}
export default async function NotificationCenterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = notificationInboxCopy(locale),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) params.append(key, part);
    else if (value !== undefined) params.append(key, value);
  }
  const filters = parseNotificationInboxQuery(params);
  let error = filters ? "" : copy.invalid,
    authenticated = false;
  const page = await (async () => {
    try {
      const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
      if (!actor) {
        error = copy.unauthorized;
        return null;
      }
      authenticated = true;
      return filters ? await notificationInboxService.page(actor.id, filters, locale) : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? notificationInboxError(locale, failure.code)
          : copy.unavailable;
      return null;
    }
  })();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3 border-b border-base pb-6">
        <Link
          href="/workspace"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.workspace}
        </Link>
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <Link
          href="/settings#notification-heading"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.settings}
        </Link>
      </header>
      {authenticated && (
        <form
          action="/notifications"
          method="get"
          className="nexus-panel flex flex-wrap items-end gap-3 p-4"
        >
          <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
            {copy.query}
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters?.query ?? ""}
              className="nexus-input block min-h-11 w-full"
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            {copy.state}
            <select
              name="state"
              defaultValue={filters?.state ?? "all"}
              className="nexus-input block min-h-11"
            >
              {(["all", "unread", "read"] as const).map((state) => (
                <option key={state} value={state}>
                  {copy[state]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            {copy.category}
            <select
              name="category"
              defaultValue={filters?.category ?? "all"}
              className="nexus-input block min-h-11"
            >
              <option value="all">{copy.all}</option>
              {INBOX_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {copy[category]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
          >
            {copy.search}
          </button>
          <Link
            href="/notifications"
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.reset}
          </Link>
        </form>
      )}
      <Link
        prefetch={false}
        href={filters ? notificationInboxHref("/notifications", filters) : "/notifications"}
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.latest}
      </Link>
      {error && (
        <p role="alert" className="nexus-panel p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {!authenticated && error === copy.unauthorized && (
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.signIn}
        </Link>
      )}
      {page && filters && (
        <NotificationInbox key={randomUUID()} initialPage={page} filters={filters} />
      )}
    </div>
  );
}
