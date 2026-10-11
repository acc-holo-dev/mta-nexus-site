function cell(value: string) {
  const safe = /^[\s]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function resourceCartReceiptsCsv(
  rows: readonly { requestId: string; createdAt: Date; reviewed: boolean; itemCount: number }[],
) {
  if (rows.length > 20) throw new RangeError("Receipt export must be bounded");
  return `\ufeff${["request_id,recorded_at_utc,evidence,resource_count", ...rows.map((row) => [row.requestId, row.createdAt.toISOString(), row.reviewed ? "reviewed" : "legacy", String(row.itemCount)].map(cell).join(","))].join("\r\n")}\r\n`;
}
