import { AppError } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import { getManagedServerCopy } from "../lib/managed-server-view";
import { getServerActivityCopy } from "../lib/server-activity-view";
import {
  parseServerWorkspaceHistoryQuery,
  serverWorkspaceHistoryHref,
  serverWorkspaceHistorySchema,
} from "../lib/server-workspace-contract";
import { serverWorkspaceCopy, serverWorkspaceError } from "../lib/server-workspace-copy";
import { authService } from "../lib/services/auth-service";
import { serverWorkspaceHistoryService } from "../lib/services/server-workspace-history-service";
import { platformFieldClass } from "../lib/user-platform-client";
export async function ServerWorkspaceHistoryScreen({
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
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      failure = copy.historyUnavailable;
      return null;
    });
  if (!actor)
    return (
      <section className="nexus-panel space-y-3 p-5">
        <h1 className="text-xl font-bold text-primary">{history.title}</h1>
        {failure ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : (
          <Link href="/auth/login" className="inline-flex min-h-11 text-accent underline">
            {labels.signIn}
          </Link>
        )}
      </section>
    );
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
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <Link
          href={`/workspace/servers/${encodeURIComponent(id)}`}
          className="inline-flex min-h-11 text-sm text-accent underline"
        >
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
          <select name="period" defaultValue={query.period} className={platformFieldClass}>
            {(["all", "7", "30", "90", "365"] as const).map((period) => (
              <option key={period} value={period}>
                {period === "all" ? copy.all : copy[`days${period}`]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-primary">
          <span>{copy.action}</span>
          <select name="action" defaultValue={query.action} className={platformFieldClass}>
            {(["all", "listing", "visibility", "control", "verification"] as const).map(
              (action) => (
                <option key={action} value={action}>
                  {action === "all" ? copy.actionAll : copy[action]}
                </option>
              ),
            )}
          </select>
        </label>
        <Button type="submit" variant="outline" className="min-h-11 text-accent">
          {copy.apply}
        </Button>
        <Link
          href={base}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reset}
        </Link>
      </form>
      {!data ? (
        <p role="alert" className="nexus-panel p-5 text-sm text-danger">
          {failure || copy.historyUnavailable}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <a
              href={exportPath}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.export}
            </a>
            <p className="text-xs text-muted">{copy.exportHelp}</p>
          </div>
          {!data.events.length ? (
            <p className="nexus-panel p-5 text-sm text-muted">{copy.historyEmpty}</p>
          ) : (
            <ol className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="nexus-panel space-y-2 p-5">
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
                      className="inline-flex min-h-11 text-sm text-accent"
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
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {history.latest}
            </Link>
            {data.nextCursor && (
              <Link
                prefetch={false}
                href={serverWorkspaceHistoryHref(id, query, data.nextCursor)}
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
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
