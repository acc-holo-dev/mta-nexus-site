import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { auditRepository } from "@nexus/db";
import { authService } from "../../../../../lib/services/auth-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getDictionary } from "../../../../../lib/i18n";
import {
  getServerActivityCopy,
  parseServerActivityCursor,
  serverActivityHref,
} from "../../../../../lib/server-activity-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Server activity | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function ServerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const copy = getServerActivityCopy(locale);
  const management = getDictionary(locale).serverManagement;
  const user = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!user)
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <h1 className="font-display text-primary">{management.signInRequired}</h1>
        <p className="font-caption text-muted">{management.signInMessage}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white"
        >
          {management.signIn}
        </Link>
      </div>
    );
  const { id } = await params;
  const cursor = parseServerActivityCursor(await searchParams);
  const activity = await auditRepository.pageForManagedServer(
    id,
    { id: user.id, role: user.role },
    cursor,
  );
  if (!activity) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <header>
        <Link
          href={`/workspace/servers/${encodeURIComponent(activity.server.id)}`}
          className="text-xs font-semibold text-accent hover:underline"
        >
          ← {copy.back}
        </Link>
        <h1 className="mt-2 text-2xl font-black text-primary">{copy.title}</h1>
        <p className="mt-1 text-lg font-semibold text-primary">{activity.server.name}</p>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
        <p className="mt-1 text-xs text-muted">{copy.private}</p>
      </header>
      {activity.events.length === 0 ? (
        <p className="nexus-panel p-5 text-sm text-muted">{cursor ? copy.end : copy.empty}</p>
      ) : (
        <ol className="nexus-panel divide-y divide-border">
          {activity.events.map((event) => {
            const actor =
              event.actorType !== "user" && event.actorType !== "admin"
                ? copy.system
                : event.actorId === user.id
                  ? copy.you
                  : event.actorUsername
                    ? `${event.actorDisplayName || event.actorUsername} (@${event.actorUsername})`
                    : copy.unknownActor;
            return (
              <li key={event.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-primary">{copy.actions[event.action]}</h2>
                  <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                    {event.createdAt.toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="text-xs text-muted">
                  {copy.actor}: {actor}
                </p>
                {event.action === "server.updated" && event.fields.length > 0 && (
                  <p className="text-sm text-muted">
                    {copy.fields}: {event.fields.map((field) => copy.fieldNames[field]).join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {(cursor || activity.nextCursor) && (
        <nav
          aria-label={copy.navigation}
          className="flex flex-wrap gap-3 text-sm font-semibold text-accent"
        >
          {cursor && (
            <Link href={serverActivityHref(id)} className="hover:underline">
              {copy.latest}
            </Link>
          )}
          {activity.nextCursor && (
            <Link href={serverActivityHref(id, activity.nextCursor)} className="hover:underline">
              {copy.older} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
