import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { serverWorkspaceHistoryService } from "../../../lib/services/servers/server-workspace-history-service";
import { platformFieldClass } from "../../community/user-platform-client";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded, linkMinHAccent } from "../../shell/link-shell";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { getManagedServerCopy } from "../managed-server-view";
import { getServerActivityCopy } from "../server-activity-view";
import {
  parseServerWorkspaceHistoryQuery,
  serverWorkspaceHistoryHref,
  serverWorkspaceHistorySchema,
} from "../server-workspace-contract";
import { serverWorkspaceCopy, serverWorkspaceError } from "../server-workspace-copy";
export async function serverWorkspaceHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${getServerActivityCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

async function ServerWorkspaceHistoryScreen({
  id,
  searchParams,
}: {
  id: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = serverWorkspaceCopy(locale),
    history = getServerActivityCopy(locale),
    labels = getManagedServerCopy(locale);
  let failure = "";
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={history.title}
        message={copy.historyUnavailable}
        retryHref={`/workspace/servers/${encodeURIComponent(id)}/activity`}
      />
    );
  }
  if (!actor) {
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/servers/${encodeURIComponent(id)}/activity`}
      />
    );
  }
  const rawParams = (await searchParams) ?? {},
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const filters = parseServerWorkspaceHistoryQuery(params);
  if (!filters) failure = copy.historyInvalid;
  const raw = filters
    ? await serverWorkspaceHistoryService.page(actor.id, id, filters).catch((error: unknown) => {
        if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
        failure =
          error instanceof AppError
            ? serverWorkspaceError(locale, error.code)
            : copy.historyUnavailable;
        return null;
      })
    : null;
  const parsed = serverWorkspaceHistorySchema.safeParse(raw),
    data =
      parsed.success &&
      parsed.data.server.id === id &&
      parsed.data.period === filters?.period &&
      parsed.data.action === filters.action
        ? parsed.data
        : null;
  const base = serverWorkspaceHistoryHref(id, {}),
    query = filters ?? { period: "all", action: "all" };
  const exportParams = new URLSearchParams(params);
  if (data) exportParams.set("until", data.until);
  const exportPath = `/api/workspace/servers/${encodeURIComponent(id)}/activity/export${exportParams.size ? `?${exportParams}` : ""}`;
  const filtered = query.period !== "all" || query.action !== "all";
  return (
    <div className={pageShellClass}>
      <header className="space-y-2">
        <Link href={`/workspace/servers/${encodeURIComponent(id)}`} className={linkAccentSmRounded}>
          {history.back}
        </Link>
        <h1 className="text-2xl font-bold text-primary">{history.title}</h1>
        {data && <p className="break-words font-semibold text-primary">{data.server.name}</p>}
        <p className="text-sm text-muted">{history.description}</p>
        <p className="text-xs text-muted">{history.private}</p>
      </header>
      <form action={base} method="get" className="nexus-panel flex flex-wrap items-end gap-4 p-5">
        <label className="flex flex-col gap-2 text-sm text-primary">
          <span>{copy.period}</span>
          <select
            name="period"
            defaultValue={query.period}
            className={`${platformFieldClass} min-h-11`}
          >
            {(["all", "7", "30", "90", "365"] as const).map((period) => (
              <option key={period} value={period}>
                {period === "all" ? copy.all : copy[`days${period}`]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-primary">
          <span>{copy.action}</span>
          <select
            name="action"
            defaultValue={query.action}
            className={`${platformFieldClass} min-h-11`}
          >
            {(["all", "listing", "visibility", "control", "verification"] as const).map(
              (action) => (
                <option key={action} value={action}>
                  {action === "all" ? copy.actionAll : copy[action]}
                </option>
              ),
            )}
          </select>
        </label>
        <Button type="submit" variant="outline" className={linkMinHAccent}>
          {copy.apply}
        </Button>
        <Link href={base} className={linkAccentSmRounded}>
          {copy.reset}
        </Link>
      </form>
      {!data ? (
        <ErrorState
          title={failure || copy.historyUnavailable}
          description={copy.historyUnavailableHint}
          action={
            <Link href={serverWorkspaceHistoryHref(id, query)} className={linkAccentSmRounded}>
              {copy.reload}
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            <a href={exportPath} className={linkAccentSmRounded}>
              {copy.export}
            </a>
            <p className="text-xs text-muted">{copy.exportHelp}</p>
          </div>
          {!data.events.length ? (
            <EmptyState
              title={filtered ? copy.historyEmpty : copy.historyEmptyNever}
              description={filtered ? copy.historyEmptyHint : copy.historyEmptyNeverHint}
              action={
                filtered ? (
                  <Link href={base} className={linkAccentSmRounded}>
                    {copy.reset}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ol className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className={panelClipSpace2P5}>
                  <h2 className="text-sm font-bold text-primary">
                    {history.actions[event.action]}
                  </h2>
                  <time dateTime={event.createdAt} className="text-xs text-muted">
                    {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
                      timeZone: "UTC",
                      timeZoneName: "short",
                    })}
                  </time>
                  <p className="text-xs text-muted">
                    {history.actor}:{" "}
                    {event.actor === "you"
                      ? history.you
                      : event.actor === "system"
                        ? history.system
                        : event.actor === "moderation"
                          ? copy.moderation
                          : event.identity
                            ? copy.team
                            : history.unknownActor}
                  </p>
                  {event.identity && (
                    <Link
                      href={`/users/${encodeURIComponent(event.identity.username)}`}
                      className={linkAccentSmRounded}
                    >
                      {copy.identity}: {event.identity.name} (@{event.identity.username})
                    </Link>
                  )}
                  {event.fields.length > 0 && (
                    <p className="text-sm text-muted">
                      {history.fields}:{" "}
                      {event.fields.map((field) => history.fieldNames[field]).join(", ")}
                    </p>
                  )}
                  {event.transition && (
                    <p className="text-sm text-primary">
                      {copy.transition}: {labels[event.transition.before]} →{" "}
                      {labels[event.transition.after]}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <nav aria-label={history.navigation} className="flex flex-wrap gap-4">
            <Link
              prefetch={false}
              href={serverWorkspaceHistoryHref(id, query)}
              className={linkAccentSmRounded}
            >
              {history.latest}
            </Link>
            {data.nextCursor && (
              <Link
                prefetch={false}
                href={serverWorkspaceHistoryHref(id, query, data.nextCursor)}
                className={linkAccentSmRounded}
              >
                {history.older}
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}

export async function ManagedServerActivityRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerWorkspaceHistoryScreen({ id: (await params).id, searchParams });
}
