import type { LicenseArchiveFilter } from "@nexus/domain";
import { Button, fieldClassBlock } from "@nexus/ui";
import Link from "next/link";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { licenseArchiveUrl } from "../license-archive-query";
import { getLicenseMaintenanceCopy } from "../license-maintenance-i18n";
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
    <section className="min-w-0 space-y-4">
      <search aria-label={copy.filters}>
        <form
          method="get"
          action="/workspace/licenses"
          className="nexus-panel grid min-w-0 gap-4 overflow-x-clip p-4 sm:grid-cols-2"
        >
          <label className="min-w-0 space-y-1 text-sm">
            <span>{copy.search}</span>
            <input name="q" className={fieldClassBlock} maxLength={120} defaultValue={query.q} />
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span>{copy.status}</span>
            <select name="status" defaultValue={query.status} className={fieldClassBlock}>
              {(["all", "active", "expiring", "expired", "suspended", "revoked"] as const).map(
                (key) => (
                  <option key={key} value={key}>
                    {copy[key]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span>{copy.binding}</span>
            <select name="binding" defaultValue={query.binding} className={fieldClassBlock}>
              {(["all", "bound", "unbound"] as const).map((key) => (
                <option key={key} value={key}>
                  {copy[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span>{copy.term}</span>
            <select name="term" defaultValue={query.term} className={fieldClassBlock}>
              {(["all", "finite", "unknown"] as const).map((key) => (
                <option key={key} value={key}>
                  {copy[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span>{copy.sort}</span>
            <select name="sort" defaultValue={query.sort} className={fieldClassBlock}>
              <option value="newest">{copy.newest}</option>
              <option value="expires_soon">{copy.expiresSoon}</option>
            </select>
          </label>
          <div className="flex min-w-0 flex-wrap items-end gap-4 text-sm">
            <Button type="submit" variant="ghost" className={`h-auto px-0 ${linkAccentSmRounded}`}>
              {copy.apply}
            </Button>
            <Link href="/workspace/licenses" className={linkAccentSmRounded}>
              {copy.clear}
            </Link>
          </div>
        </form>
      </search>
      <p className="text-sm text-muted">{copy.archiveNote}</p>
      <a
        href={licenseArchiveUrl({ ...query, page }, "/api/licenses/export")}
        className={linkAccentSmRounded}
      >
        {copy.export}
      </a>
    </section>
  );
}
