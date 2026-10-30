import type { LicenseArchiveFilter } from "@nexus/domain";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { getLicenseMaintenanceCopy } from "../lib/license-maintenance-i18n";
import { licenseArchiveUrl } from "../lib/license-archive-query";
export function LicenseArchiveFilters({
  query,
  page,
  locale,
}: {
  query: LicenseArchiveFilter & { page: number };
  page: number;
  locale: "ru" | "en";
}) {
  const copy = getLicenseMaintenanceCopy(locale);
  return (
    <section className="space-y-4">
      <form
        method="get"
        action="/workspace/licenses"
        className="nexus-panel grid gap-4 p-4 sm:grid-cols-2"
        aria-label={copy.filters}
      >
        <label className="space-y-1 text-sm">
          <span>{copy.search}</span>
          <input name="q" className="nexus-input w-full" maxLength={120} defaultValue={query.q} />
        </label>
        <label className="space-y-1 text-sm">
          <span>{copy.status}</span>
          <select name="status" defaultValue={query.status} className="nexus-input w-full">
            {(["all", "active", "expiring", "expired", "suspended", "revoked"] as const).map(
              (key) => (
                <option key={key} value={key}>
                  {copy[key]}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{copy.binding}</span>
          <select name="binding" defaultValue={query.binding} className="nexus-input w-full">
            {(["all", "bound", "unbound"] as const).map((key) => (
              <option key={key} value={key}>
                {copy[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{copy.term}</span>
          <select name="term" defaultValue={query.term} className="nexus-input w-full">
            {(["all", "finite", "unknown"] as const).map((key) => (
              <option key={key} value={key}>
                {copy[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{copy.sort}</span>
          <select name="sort" defaultValue={query.sort} className="nexus-input w-full">
            <option value="newest">{copy.newest}</option>
            <option value="expires_soon">{copy.expiresSoon}</option>
          </select>
        </label>
        <div className="flex items-end gap-4 text-sm">
          <Button
            type="submit"
            variant="ghost"
            className="h-auto px-0 text-sm text-accent underline"
          >
            {copy.apply}
          </Button>
          <Link href="/workspace/licenses" className="text-accent underline">
            {copy.clear}
          </Link>
        </div>
      </form>
      <p className="text-sm text-muted">{copy.archiveNote}</p>
      <a
        href={licenseArchiveUrl({ ...query, page }, "/api/licenses/export")}
        className="text-sm text-accent underline"
      >
        {copy.export}
      </a>
    </section>
  );
}
