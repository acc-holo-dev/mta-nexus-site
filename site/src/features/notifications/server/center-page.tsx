import { randomUUID } from "node:crypto";
import { AppError } from "@nexus/domain";
import { Button, ErrorState, fieldClass } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { notificationInboxService } from "../../../lib/services/notifications/notification-inbox-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xlTight } from "../../shell/page-shell";
import { panelFlexWrapEndP4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { NotificationCenterTabs } from "../components/notification-center-tabs";
import { NotificationInbox } from "../components/notification-inbox";
import {
  INBOX_CATEGORIES,
  INBOX_PERIODS,
  notificationInboxHref,
  parseNotificationInboxQuery,
} from "../notification-inbox-contract";
import { notificationInboxCopy, notificationInboxError } from "../notification-inbox-copy";
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
    dictionary = getDictionary(locale),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) params.append(key, part);
    else if (value !== undefined) params.append(key, value);
  }
  const returnPath = params.size ? `/notifications?${params}` : "/notifications";
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  const filters = parseNotificationInboxQuery(params);
  const filtersActive = Boolean(
    filters &&
      (filters.query ||
        filters.state !== "all" ||
        filters.category !== "all" ||
        (filters.period && filters.period !== "all")),
  );
  let error = filters ? "" : copy.invalid;
  const page = await (async () => {
    try {
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
    <div className={pageShellMax4xlTight}>
      <header className="space-y-3 border-b border-base pb-6">
        <Link href="/workspace" className={linkAccentSm}>
          {copy.workspace}
        </Link>
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">{copy.openBetaNote}</p>
        <Link href="/settings#notification-heading" className={linkAccentSm}>
          {copy.settings}
        </Link>
      </header>
      <NotificationCenterTabs
        state={filters?.state ?? "all"}
        filters={filters}
        labels={{
          title: copy.title,
          readingState: copy.readingState,
          all: copy.all,
          unread: copy.unread,
          read: copy.read,
        }}
      >
        <search aria-label={copy.filters}>
          <form action="/notifications" method="get" className={panelFlexWrapEndP4}>
            <label className="min-w-0 flex-1 space-y-1 text-xs text-muted sm:min-w-40">
              {copy.query}
              <input
                type="search"
                name="q"
                maxLength={100}
                defaultValue={filters?.query ?? ""}
                className={`${fieldClass} block min-h-11 w-full`}
              />
            </label>
            <input type="hidden" name="state" value={filters?.state ?? "all"} />
            <label className="space-y-1 text-xs text-muted">
              {copy.category}
              <select
                name="category"
                defaultValue={filters?.category ?? "all"}
                className={`${fieldClass} block min-h-11`}
              >
                <option value="all">{copy.all}</option>
                {INBOX_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {copy[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              {copy.period}
              <select
                name="period"
                defaultValue={filters?.period ?? "all"}
                className={`${fieldClass} block min-h-11`}
              >
                {INBOX_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period === "all" ? copy.all : copy[`period${period}`]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="min-h-11 font-semibold">
              {copy.search}
            </Button>
            {filtersActive ? (
              <Link href="/notifications" className={linkAccentSm}>
                {copy.reset}
              </Link>
            ) : null}
          </form>
        </search>
        <Link
          prefetch={false}
          href={
            filters
              ? notificationInboxHref("/notifications", { ...filters, at: undefined })
              : "/notifications"
          }
          className={linkAccentSm}
        >
          {copy.latest}
        </Link>
        {error ? (
          <ErrorState
            title={error}
            description={copy.unavailableHint}
            action={
              <Link href={returnPath} className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        ) : null}
        {page && filters && (
          <NotificationInbox
            key={randomUUID()}
            initialPage={page}
            filters={filters}
            actorId={actor.id}
          />
        )}
      </NotificationCenterTabs>
    </div>
  );
}
