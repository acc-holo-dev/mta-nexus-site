import { type SQL, and, eq, isNotNull, sql } from "drizzle-orm";
import { builds } from "../schema";

export function trustedCleanScanCondition() {
  return and(
    eq(builds.scanStatus, "clean"),
    isNotNull(builds.scanner),
    sql`btrim(${builds.scanner}) <> ''`,
    isNotNull(builds.scannedAt),
  );
}

export function safePublishedBuildCondition(productId: string | SQL) {
  return and(
    eq(builds.productId, productId),
    eq(builds.status, "published"),
    trustedCleanScanCondition(),
  );
}
