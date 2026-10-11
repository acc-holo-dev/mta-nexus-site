type Row = {
  id: string;
  productTitle: string;
  effectiveStatus: string;
  model: string;
  expiresAt: Date | null;
  createdAt: Date;
  serverBound: boolean;
};
function cell(value: string) {
  const safe = /^[\s]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** Exactly the displayed private page, with no keys, account IDs or binding IDs. */
export function licenseArchiveCsv(rows: readonly Row[]): string {
  if (rows.length > 20) throw new RangeError("License export must be bounded");
  const lines = ["license_id,resource,status,model,expires_at_utc,issued_at_utc,server_bound"];
  for (const row of rows)
    lines.push(
      [
        row.id,
        row.productTitle,
        row.effectiveStatus,
        row.model,
        row.expiresAt?.toISOString() ?? "",
        row.createdAt.toISOString(),
        row.serverBound ? "yes" : "no",
      ]
        .map(cell)
        .join(","),
    );
  return `\ufeff${lines.join("\r\n")}\r\n`;
}
