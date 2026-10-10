import type { licenseControlService } from "../lib/services/license-control-service";
import { getLicenseControlCopy, licenseActionLabel } from "../lib/license-control-i18n";
import { getCommerceHistoryCopy } from "../lib/commerce-history-i18n";
import { formatHistoryDate, licenseStatusLabel } from "../lib/commerce-history-format";

type Detail = NonNullable<Awaited<ReturnType<typeof licenseControlService.detail>>>;
export function LicenseDetailView({ license, locale }: { license: Detail; locale: "ru" | "en" }) {
  const copy = getLicenseControlCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <>
      <header className="space-y-2">
        <h1 className="font-display text-primary">{license.productTitle}</h1>
        <p className="text-sm text-secondary">
          {licenseStatusLabel(license.effectiveStatus, history.licenseStatuses)} · {license.id}
        </p>
      </header>
      <dl className="nexus-panel grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">{copy.term}</dt>
          <dd>
            {license.expiresAt ? formatHistoryDate(license.expiresAt, locale) : history.never}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{history.model}</dt>
          <dd>{license.model.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-muted">{copy.binding}</dt>
          <dd>
            {license.boundServerId
              ? (license.serverName ?? copy.serverUnavailable)
              : license.legacyServerBound
                ? history.bound
                : copy.noBinding}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{copy.tokenState}</dt>
          <dd>
            {license.tokenActive && license.bindingReady && license.canActivate
              ? copy.active
              : copy.inactive}
          </dd>
        </div>
      </dl>
      {license.boundServerId && (
        <p className="text-sm text-secondary">
          {license.bindingReady ? copy.available : copy.changed}
        </p>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">{copy.history}</h2>
        {license.history.length === 0 ? (
          <p className="text-sm text-muted">{copy.noHistory}</p>
        ) : (
          <ol className="space-y-2">
            {license.history.map((event) => (
              <li key={event.id} className="nexus-panel space-y-1 p-4 text-sm">
                <p>
                  {licenseActionLabel(locale, event.action)} ·{" "}
                  <time dateTime={event.createdAt.toISOString()}>
                    {formatHistoryDate(event.createdAt, locale)}
                  </time>
                </p>
                {event.reason && <p className="break-words text-secondary">{event.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
