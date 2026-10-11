import type { SellerSale } from "@nexus/domain";

function cell(value: string) {
  const cleaned = Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159) ? " " : char;
  }).join("");
  const safe = /^\s*[=+\-@]/u.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function sellerSalesCsv(rows: readonly SellerSale[], observedAt: Date) {
  if (rows.length > 20) throw new RangeError("Sales export must be bounded");
  const csv = `\ufeff${["observed_at_utc,line_id,order_number,product_id,product_title,title_source,order_recorded_at_utc,order_status,line_value_minor_units,currency,payment_record_evidence", ...rows.map((row) => [observedAt.toISOString(), row.id, row.orderNumber, row.productId, row.productTitle, row.titleSource ?? "current", row.createdAt.toISOString(), row.status, String(row.unitPrice), row.currency, row.evidence].map(cell).join(","))].join("\r\n")}\r\n`;
  if (Buffer.byteLength(csv, "utf8") > 128 * 1024)
    throw new RangeError("Sales export is too large");
  return csv;
}
