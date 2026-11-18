import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StorageCleanupControls } from "../../../../../features/moderation/storage-maintenance";
import { storageMaintenanceCopy } from "../../../../../features/moderation/storage-maintenance-i18n";
import { PlatformSignIn } from "../../../../../features/shell/guest-auth";
import { PlatformSessionError } from "../../../../../features/shell/session-error";

import { getDictionary } from "../../../../../lib/platform/i18n";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { storageMaintenanceService } from "../../../../../lib/services/moderation/storage-maintenance-service";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]);
  const copy = storageMaintenanceCopy(locale);
  const dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/storage/objects/"}
      />
    );
  }

  if (!actor)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/admin/storage/objects/${encodeURIComponent(id)}`}
      />
    );
  if (actor.role !== "admin") notFound();
  const returnHref = `/admin/storage/objects/${encodeURIComponent(id)}`;
  let missing = false;
  const item = await storageMaintenanceService.detail(actor.id, id).catch((error: unknown) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) {
      missing = true;
      return null;
    }
    return null;
  });
  if (missing) notFound();
  if (!item) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
        <Link href="/admin/storage" className={linkClass}>
          {copy.inventory}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const canRetry =
    item.state === "failed" ||
    (item.state === "retired" &&
      (!item.leaseExpiresAt || item.leaseExpiresAt.getTime() <= Date.now()));
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
      <Link href="/admin/storage" className={linkClass}>
        {copy.inventory}
      </Link>
      <h1>{copy.detail}</h1>
      <code className="block break-all">{item.storageKey}</code>
      <dl className="nexus-panel grid gap-3 p-4">
        {[
          [copy.status, copy.states[item.state]],
          [copy.revision, item.revision],
          [copy.size, item.identity.sizeBytes],
          [copy.hash, item.identity.sha256Hash],
          [copy.referenced, item.referenced ? copy.yes : copy.no],
          [copy.eligible, item.eligible ? copy.yes : copy.no],
          [copy.modified, item.modifiedAt.toISOString()],
          [copy.observed, item.observedAt.toISOString()],
          [copy.retired, item.retiredAt?.toISOString() ?? "—"],
          [copy.lease, item.leaseExpiresAt?.toISOString() ?? "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {(item.eligible || canRetry) && (
        <StorageCleanupControls
          key={`${actor.id}:${item.id}:${item.revision}`}
          actorId={actor.id}
          id={item.id}
          revision={item.revision}
          locale={locale}
        />
      )}
      {item.resultCode ? <ErrorState title={copy.error} description={item.resultCode} /> : null}
    </div>
  );
}
