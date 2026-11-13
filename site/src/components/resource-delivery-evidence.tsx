import type { ResourceDeliveryReceipt } from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import { formatHistoryDate } from "../lib/commerce-history-format";
import { resourceDeliveriesCopy } from "../lib/resource-deliveries-i18n";
/** Server-only evidence projection; never serialize account/storage context. */
export function ResourceDeliveryEvidence({
  receipt,
  locale,
}: {
  receipt: ResourceDeliveryReceipt;
  locale: Locale;
}) {
  const copy = resourceDeliveriesCopy(locale);
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted">{copy.version}</dt>
        <dd className="break-words text-primary">{receipt.version}</dd>
      </div>
      <div>
        <dt className="text-muted">{copy.receipt}</dt>
        <dd className="break-all text-primary">{receipt.id}</dd>
      </div>
      <div>
        <dt className="text-muted">{copy.bytes}</dt>
        <dd>
          {receipt.status === "started" ? "—" : receipt.bytesSent.toLocaleString(locale)} /{" "}
          {receipt.expectedBytes.toLocaleString(locale)}
        </dd>
      </div>
      <div>
        <dt className="text-muted">{copy.startedAt}</dt>
        <dd>
          <time dateTime={receipt.startedAt.toISOString()}>
            {formatHistoryDate(receipt.startedAt, locale)}
          </time>
        </dd>
      </div>
      {receipt.finishedAt ? (
        <div>
          <dt className="text-muted">{copy.finishedAt}</dt>
          <dd>
            <time dateTime={receipt.finishedAt.toISOString()}>
              {formatHistoryDate(receipt.finishedAt, locale)}
            </time>
          </dd>
        </div>
      ) : null}
      {receipt.errorCode ? (
        <div>
          <dt className="text-muted">{copy.error}</dt>
          <dd>{copy[receipt.errorCode]}</dd>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <dt className="text-muted">{copy.hash}</dt>
        <dd className="break-all font-mono text-xs">{receipt.sha256Hash}</dd>
      </div>
    </dl>
  );
}
