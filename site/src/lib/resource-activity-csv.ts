import type { ResourceActivityReport } from "@nexus/db";

/** Deliberately exclude titles, buyer identifiers, secrets and free-text cells. */
export function resourceActivityCsv(report: ResourceActivityReport): string {
  const lines = ["utc_day,free_acquisitions,download_starts"];
  for (const row of report.timeline) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(row.day) ||
      !Number.isSafeInteger(row.acquisitions) ||
      row.acquisitions < 0 ||
      !Number.isSafeInteger(row.downloadStarts) ||
      row.downloadStarts < 0
    )
      throw new RangeError("Invalid activity export row");
    lines.push(`${row.day},${row.acquisitions},${row.downloadStarts}`);
  }
  return `${lines.join("\r\n")}\r\n`;
}
