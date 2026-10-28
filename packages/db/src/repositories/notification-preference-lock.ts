import { sql } from "drizzle-orm";
import type { db } from "../client";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const LOCK_NAMESPACE = "nexus:notification-preference:v1:";

function normalizedUserIds(userIds: readonly string[]): string[] {
  return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))].sort();
}

export async function lockNotificationPreferencesForUsers(
  tx: Tx,
  userIds: readonly string[],
): Promise<void> {
  for (const userId of normalizedUserIds(userIds)) {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${LOCK_NAMESPACE + userId}, 0)
      )
    `);
  }
}
