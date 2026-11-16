import type { ResourceDeliveryReceipt } from "@nexus/domain";
function cell(value: string) {
  const safe = /^[\s]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** Exactly one private page; no account IDs, storage paths or authorization keys. */
export function resourceDeliveriesCsv(rows: readonly ResourceDeliveryReceipt[]) {
  if (rows.length > 20) throw new RangeError("Delivery export must be bounded");
  const lines = [
    "receipt_id,resource_id,resource,build_id,version,status,bytes_emitted,archive_bytes,sha256,requested_exact_version,started_at_utc,finished_at_utc,error",
  ];
  for (const row of rows)
    lines.push(
      [
        row.id,
        row.resourceId,
        row.title ?? "",
        row.buildId,
        row.version,
        row.status,
        row.status === "started" ? "" : String(row.bytesSent),
        String(row.expectedBytes),
        row.sha256Hash,
        row.pinned ? "yes" : "no",
        row.startedAt.toISOString(),
        row.finishedAt?.toISOString() ?? "",
        row.errorCode ?? "",
      ]
        .map(cell)
        .join(","),
    );
  return `\ufeff${lines.join("\r\n")}\r\n`;
}
