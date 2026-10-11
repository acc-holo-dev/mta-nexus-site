import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StorageCleanupControls } from "../../../../../components/storage-maintenance-controls";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { storageMaintenanceService } from "../../../../../lib/services/storage-maintenance-service";
import { storageMaintenanceCopy } from "../../../../../lib/storage-maintenance-i18n";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (actor?.role !== "admin") notFound();
  const item = await storageMaintenanceService.detail(actor.id, id).catch((error: unknown) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    throw error;
  });
  const copy = storageMaintenanceCopy(locale),
    canRetry =
      item.state === "failed" ||
      (item.state === "retired" &&
        (!item.leaseExpiresAt || item.leaseExpiresAt.getTime() <= Date.now()));
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/storage" className="text-accent underline">
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
          key={`${item.id}:${item.revision}`}
          id={item.id}
          revision={item.revision}
          locale={locale}
        />
      )}
      {item.resultCode && <p className="text-danger">{copy.error}</p>}
    </div>
  );
}
